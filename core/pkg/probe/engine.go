package probe

import (
	"context"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/turboprobe/turboprobe-core/pkg/geoip"
	"github.com/turboprobe/turboprobe-core/pkg/parser"
)

// ProbeOptions holds configuration parameters for the benchmark session
type ProbeOptions struct {
	Concurrency  int           `json:"concurrency"`   // number of parallel workers (e.g. 50-100)
	Timeout      time.Duration `json:"timeout"`       // per-node timeout (e.g. 2500ms)
	TargetURL    string        `json:"target_url"`    // test target (Cloudflare, Google, custom)
	EnableBurst  bool          `json:"enable_burst"`  // run micro-burst jitter test
	EnableGeoIP  bool          `json:"enable_geoip"`  // resolve country & ISP
}

// ProgressUpdate represents a real-time progress event emitted during testing
type ProgressUpdate struct {
	TotalCount   int                `json:"total_count"`
	TestedCount  int                `json:"tested_count"`
	AliveCount   int                `json:"alive_count"`
	DeadCount    int                `json:"dead_count"`
	Percent      float64            `json:"percent"`
	LastTested   *parser.NodeConfig `json:"last_tested,omitempty"`
	IsCompleted  bool               `json:"is_completed"`
	AveragePing  int64              `json:"average_ping_ms"`
}

// Engine manages parallel testing sessions
type Engine struct {
	geoResolver *geoip.Resolver
	cancelFn    context.CancelFunc
	mu          sync.Mutex
	isRunning   bool
}

// NewEngine creates a new probe engine
func NewEngine() *Engine {
	return &Engine{
		geoResolver: geoip.NewResolver(),
	}
}

// Stop cancels any currently running probe session
func (e *Engine) Stop() {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.cancelFn != nil {
		e.cancelFn()
		e.cancelFn = nil
	}
	e.isRunning = false
}

// IsRunning returns true if a session is actively testing
func (e *Engine) IsRunning() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.isRunning
}

// RunBenchmark tests a slice of nodes in parallel and streams progress updates
func (e *Engine) RunBenchmark(
	ctx context.Context,
	nodes []*parser.NodeConfig,
	opts ProbeOptions,
	onProgress func(ProgressUpdate),
) []*parser.NodeConfig {
	e.mu.Lock()
	ctx, cancel := context.WithCancel(ctx)
	e.cancelFn = cancel
	e.isRunning = true
	e.mu.Unlock()

	defer func() {
		e.mu.Lock()
		e.isRunning = false
		e.mu.Unlock()
	}()

	if opts.Concurrency <= 0 {
		opts.Concurrency = 50
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 3 * time.Second
	}

	total := len(nodes)
	if total == 0 {
		if onProgress != nil {
			onProgress(ProgressUpdate{IsCompleted: true, Percent: 100})
		}
		return nodes
	}

	var (
		testedCount int64
		aliveCount  int64
		deadCount   int64
		totalPingSum int64
	)

	jobs := make(chan *parser.NodeConfig, total)
	for _, n := range nodes {
		jobs <- n
	}
	close(jobs)

	var wg sync.WaitGroup
	workers := opts.Concurrency
	if workers > total {
		workers = total
	}

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for node := range jobs {
				select {
				case <-ctx.Done():
					return
				default:
				}

				e.probeSingleNode(ctx, node, opts)

				currentTested := atomic.AddInt64(&testedCount, 1)
				if node.IsAlive {
					atomic.AddInt64(&aliveCount, 1)
					atomic.AddInt64(&totalPingSum, node.PingMs)
				} else {
					atomic.AddInt64(&deadCount, 1)
				}

				if onProgress != nil {
					alive := atomic.LoadInt64(&aliveCount)
					var avgPing int64
					if alive > 0 {
						avgPing = atomic.LoadInt64(&totalPingSum) / alive
					}

					pct := float64(currentTested) / float64(total) * 100.0
					onProgress(ProgressUpdate{
						TotalCount:  total,
						TestedCount: int(currentTested),
						AliveCount:  int(alive),
						DeadCount:   int(atomic.LoadInt64(&deadCount)),
						Percent:     pct,
						LastTested:  node,
						IsCompleted: int(currentTested) == total,
						AveragePing: avgPing,
					})
				}
			}
		}()
	}

	wg.Wait()

	// Sort nodes: Alive first, then by Score descending, then by Ping ascending
	sort.SliceStable(nodes, func(i, j int) bool {
		if nodes[i].IsAlive != nodes[j].IsAlive {
			return nodes[i].IsAlive
		}
		if nodes[i].Score != nodes[j].Score {
			return nodes[i].Score > nodes[j].Score
		}
		return nodes[i].PingMs < nodes[j].PingMs
	})

	if onProgress != nil {
		alive := atomic.LoadInt64(&aliveCount)
		var avgPing int64
		if alive > 0 {
			avgPing = atomic.LoadInt64(&totalPingSum) / alive
		}
		onProgress(ProgressUpdate{
			TotalCount:  total,
			TestedCount: int(testedCount),
			AliveCount:  int(alive),
			DeadCount:   int(deadCount),
			Percent:     100.0,
			IsCompleted: true,
			AveragePing: avgPing,
		})
	}

	return nodes
}

func (e *Engine) probeSingleNode(ctx context.Context, node *parser.NodeConfig, opts ProbeOptions) {
	node.TestedAt = time.Now()

	// 1. True Protocol-Level Tunnel Check (VLESS UUID / Trojan / TLS / HTTP 204)
	tun := CheckTunnel(ctx, node, opts.Timeout)
	if !tun.Success {
		node.IsAlive = false
		node.ErrorMsg = tun.Error.Error()
		node.PingMs = 9999
		node.Score = 0
		return
	}

	// 2. Burst & Jitter Check
	var burst BurstResult
	if opts.EnableBurst {
		burst = RunMicroBurst(ctx, node, opts.Timeout)
		node.JitterMs = burst.Jitter.Milliseconds()
		node.PacketLoss = burst.PacketLoss
		if burst.AveragePing > 0 {
			node.PingMs = burst.AveragePing.Milliseconds()
		} else {
			node.PingMs = tun.RTT.Milliseconds()
		}
	} else {
		node.PingMs = tun.RTT.Milliseconds()
		node.PacketLoss = 0
		node.JitterMs = 0
	}

	node.IsAlive = true
	node.HTTPStatus = 204

	// 3. Resolve GeoIP if enabled
	if opts.EnableGeoIP && e.geoResolver != nil {
		geo, err := e.geoResolver.Resolve(ctx, node.Server)
		if err == nil && geo != nil {
			node.CountryCode = geo.CountryCode
			node.CountryName = geo.CountryName
			node.City = geo.City
			node.FlagEmoji = geo.FlagEmoji
			node.ISP = geo.ISP
		}
	}

	// 4. Calculate Quality Score (0 to 100)
	node.Score = calculateScore(node)
}

func calculateScore(node *parser.NodeConfig) int {
	if !node.IsAlive {
		return 0
	}

	score := 0

	// Ping contribution (max 40 pts)
	switch {
	case node.PingMs < 80:
		score += 40
	case node.PingMs < 150:
		score += 30
	case node.PingMs < 250:
		score += 20
	case node.PingMs < 400:
		score += 10
	default:
		score += 5
	}

	// Packet loss contribution (max 30 pts)
	switch {
	case node.PacketLoss == 0:
		score += 30
	case node.PacketLoss < 0.34:
		score += 15
	default:
		score += 0
	}

	// Jitter contribution (max 20 pts)
	switch {
	case node.JitterMs < 15:
		score += 20
	case node.JitterMs < 40:
		score += 12
	case node.JitterMs < 80:
		score += 6
	default:
		score += 2
	}

	// Protocol modernness bonus (max 10 pts)
	if node.Protocol == parser.ProtoVLESS && node.Security == "reality" {
		score += 10
	} else if node.Protocol == parser.ProtoHysteria2 || node.Protocol == parser.ProtoTUIC {
		score += 10
	} else if node.Protocol == parser.ProtoTrojan {
		score += 8
	} else {
		score += 5
	}

	if score > 100 {
		score = 100
	}
	return score
}
