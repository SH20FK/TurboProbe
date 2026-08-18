package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/turboprobe/turboprobe-core/pkg/exporter"
	"github.com/turboprobe/turboprobe-core/pkg/parser"
	"github.com/turboprobe/turboprobe-core/pkg/probe"
	"github.com/turboprobe/turboprobe-core/pkg/server"
)

func main() {
	var (
		serverMode  = flag.Bool("server", true, "Run in background HTTP/WebSocket server mode for UI")
		port        = flag.Int("port", 8999, "Port for the API server")
		inputFile   = flag.String("input", "", "Path to file with VPN keys/subscriptions or raw URL")
		targetURL   = flag.String("target", "http://cp.cloudflare.com/generate_204", "Target URL for HTTP benchmark")
		concurrency = flag.Int("c", 50, "Number of concurrent probe workers")
		timeoutMs   = flag.Int("timeout", 2500, "Timeout per node in milliseconds")
		burst       = flag.Bool("burst", true, "Enable micro-burst packet loss & jitter test")
		geoip       = flag.Bool("geoip", true, "Enable GeoIP lookup")
		exportFile  = flag.String("export", "", "Path to export working keys")
		exportFmt   = flag.String("format", "raw", "Export format: raw, base64, clash, singbox")
		maxPing     = flag.Int64("max-ping", 400, "Filter nodes with ping <= max-ping for export")
	)

	flag.Parse()

	if *inputFile == "" || *serverMode && *inputFile == "" {
		// Default: Run as local server
		fmt.Printf("🚀 Starting TurboProbe VPN Core v1.0.0 on port %d...\n", *port)
		srv := server.NewServer(*port)
		if err := srv.Start(); err != nil {
			log.Fatalf("Server exited with error: %v", err)
		}
		return
	}

	// CLI Mode
	fmt.Println("⚡ TurboProbe VPN Benchmark CLI")
	content := *inputFile
	if _, err := os.Stat(*inputFile); err == nil {
		data, err := os.ReadFile(*inputFile)
		if err == nil {
			content = string(data)
		}
	}

	ctx := context.Background()
	fmt.Println("🔍 Parsing and deduplicating input keys...")
	nodes, err := parser.ParseInput(ctx, content)
	if err != nil {
		log.Fatalf("Failed to parse input: %v", err)
	}

	fmt.Printf("✅ Loaded %d unique nodes. Starting Turbo-Probe on %d workers...\n", len(nodes), *concurrency)

	eng := probe.NewEngine()
	opts := probe.ProbeOptions{
		Concurrency: *concurrency,
		Timeout:     time.Duration(*timeoutMs) * time.Millisecond,
		TargetURL:   *targetURL,
		EnableBurst: *burst,
		EnableGeoIP: *geoip,
	}

	start := time.Now()
	tested := eng.RunBenchmark(ctx, nodes, opts, func(pu probe.ProgressUpdate) {
		fmt.Printf("\r⏳ Progress: %d/%d (%.1f%%) | Alive: %d | Dead: %d | Avg Ping: %dms",
			pu.TestedCount, pu.TotalCount, pu.Percent, pu.AliveCount, pu.DeadCount, pu.AveragePing)
	})
	fmt.Println()

	duration := time.Since(start)
	fmt.Printf("\n✨ Benchmark completed in %v!\n\n", duration)

	aliveCount := 0
	for _, n := range tested {
		if n.IsAlive {
			aliveCount++
			fmt.Printf("🟢 [%s %s] %-10s | Ping: %4dms | Jitter: %3dms | Loss: %2.0f%% | Score: %3d | %s\n",
				n.FlagEmoji, n.CountryCode, n.Protocol, n.PingMs, n.JitterMs, n.PacketLoss*100, n.Score, n.Name)
		}
	}

	fmt.Printf("\n📊 Total alive: %d / %d\n", aliveCount, len(nodes))

	if *exportFile != "" {
		res, count := exporter.Export(tested, exporter.ExportFormat(*exportFmt), exporter.FilterOptions{
			OnlyAlive: true,
			MaxPingMs: *maxPing,
		})
		if err := os.WriteFile(*exportFile, []byte(res), 0644); err != nil {
			log.Fatalf("Failed to write export file: %v", err)
		}
		fmt.Printf("💾 Exported %d nodes to %s (%s format)\n", count, *exportFile, *exportFmt)
	}
}
