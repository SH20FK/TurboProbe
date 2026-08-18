package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/turboprobe/turboprobe-core/pkg/exporter"
	"github.com/turboprobe/turboprobe-core/pkg/parser"
	"github.com/turboprobe/turboprobe-core/pkg/probe"
)

type Server struct {
	engine     *probe.Engine
	hub        *Hub
	nodes      []*parser.NodeConfig
	lastUpdate probe.ProgressUpdate
	mu         sync.RWMutex
	port       int
}

func NewServer(port int) *Server {
	return &Server{
		engine: probe.NewEngine(),
		hub:    NewHub(),
		port:   port,
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/ws", s.handleWebSocket)
	mux.HandleFunc("/api/parse", s.handleParse)
	mux.HandleFunc("/api/test/start", s.handleStartTest)
	mux.HandleFunc("/api/test/stop", s.handleStopTest)
	mux.HandleFunc("/api/test/status", s.handleTestStatus)
	mux.HandleFunc("/api/export", s.handleExport)

	addr := fmt.Sprintf("127.0.0.1:%d", s.port)
	log.Printf("[TurboProbe Server] Listening on http://%s", addr)

	return http.ListenAndServe(addr, enableCORS(mux))
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "ok",
		"version": "1.0.0",
		"time":    time.Now().Unix(),
	})
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	s.hub.AddClient(conn)
}

type ParseRequest struct {
	Input string `json:"input"`
}

type ParseResponse struct {
	Success bool                 `json:"success"`
	Count   int                  `json:"count"`
	Nodes   []*parser.NodeConfig `json:"nodes"`
	Error   string               `json:"error,omitempty"`
}

func (s *Server) handleParse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ParseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ParseResponse{Error: "Invalid JSON body"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	nodes, err := parser.ParseInput(ctx, req.Input)
	if err != nil {
		writeJSON(w, http.StatusOK, ParseResponse{Success: false, Error: err.Error()})
		return
	}

	s.mu.Lock()
	s.nodes = nodes
	s.lastUpdate = probe.ProgressUpdate{
		TotalCount:  len(nodes),
		TestedCount: 0,
		AliveCount:  0,
		DeadCount:   0,
	}
	s.mu.Unlock()

	writeJSON(w, http.StatusOK, ParseResponse{
		Success: true,
		Count:   len(nodes),
		Nodes:   nodes,
	})
}

type StartTestRequest struct {
	Concurrency int    `json:"concurrency"`
	TimeoutMs   int    `json:"timeout_ms"`
	TargetURL   string `json:"target_url"`
	EnableBurst bool   `json:"enable_burst"`
	EnableGeoIP bool   `json:"enable_geoip"`
}

func (s *Server) handleStartTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req StartTestRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	s.mu.RLock()
	nodes := s.nodes
	s.mu.RUnlock()

	if len(nodes) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "No parsed nodes available. Please call /api/parse first."})
		return
	}

	if s.engine.IsRunning() {
		s.engine.Stop()
		time.Sleep(100 * time.Millisecond)
	}

	concurrency := req.Concurrency
	if concurrency <= 0 {
		concurrency = 50
	}

	timeout := time.Duration(req.TimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = 2500 * time.Millisecond
	}

	targetURL := req.TargetURL
	if targetURL == "" {
		targetURL = "http://cp.cloudflare.com/generate_204"
	}

	opts := probe.ProbeOptions{
		Concurrency: concurrency,
		Timeout:     timeout,
		TargetURL:   targetURL,
		EnableBurst: req.EnableBurst,
		EnableGeoIP: req.EnableGeoIP,
	}

	// Run probe in background goroutine
	go func() {
		ctx := context.Background()
		s.engine.RunBenchmark(ctx, nodes, opts, func(pu probe.ProgressUpdate) {
			s.mu.Lock()
			s.lastUpdate = pu
			s.mu.Unlock()

			// Broadcast via WebSocket
			s.hub.Broadcast(map[string]interface{}{
				"type": "progress",
				"data": pu,
			})
		})

		s.hub.Broadcast(map[string]interface{}{
			"type":  "complete",
			"nodes": nodes,
		})
	}()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Benchmark session started",
		"total":   len(nodes),
	})
}

func (s *Server) handleStopTest(w http.ResponseWriter, r *http.Request) {
	s.engine.Stop()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Benchmark session stopped",
	})
}

func (s *Server) handleTestStatus(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"is_running":  s.engine.IsRunning(),
		"progress":    s.lastUpdate,
		"total_nodes": len(s.nodes),
		"nodes":       s.nodes,
	})
}

type ExportRequest struct {
	Format    string                 `json:"format"` // raw, base64, clash, singbox
	Filters   exporter.FilterOptions `json:"filters"`
}

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	s.mu.RLock()
	nodes := s.nodes
	s.mu.RUnlock()

	content, count := exporter.Export(nodes, exporter.ExportFormat(req.Format), req.Filters)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"format":  req.Format,
		"count":   count,
		"content": content,
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
