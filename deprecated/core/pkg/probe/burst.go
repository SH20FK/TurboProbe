package probe

import (
	"context"
	"math"
	"time"

	"github.com/turboprobe/turboprobe-core/pkg/parser"
)

// BurstResult holds jitter and stability metrics from rapid micro-burst tests
type BurstResult struct {
	Pings       []time.Duration
	AveragePing time.Duration
	Jitter      time.Duration
	PacketLoss  float64 // 0.0 to 1.0
	Success     bool
}

// RunMicroBurst executes a 3-packet micro-burst to detect packet loss and jitter
func RunMicroBurst(ctx context.Context, node *parser.NodeConfig, timeout time.Duration) BurstResult {
	const burstCount = 3
	var pings []time.Duration
	failedCount := 0

	for i := 0; i < burstCount; i++ {
		select {
		case <-ctx.Done():
			return BurstResult{PacketLoss: 1.0, Success: false}
		default:
		}

		res := CheckHandshake(ctx, node, timeout)
		if res.Success {
			pings = append(pings, res.TotalTime)
		} else {
			failedCount++
		}

		if i < burstCount-1 {
			time.Sleep(30 * time.Millisecond) // micro-gap between burst packets
		}
	}

	packetLoss := float64(failedCount) / float64(burstCount)
	if len(pings) == 0 {
		return BurstResult{
			PacketLoss: 1.0,
			Success:    false,
		}
	}

	var sum time.Duration
	for _, p := range pings {
		sum += p
	}
	avg := sum / time.Duration(len(pings))

	// Calculate jitter (mean absolute deviation)
	var jitterSum float64
	for _, p := range pings {
		diff := float64(p - avg)
		jitterSum += math.Abs(diff)
	}
	jitter := time.Duration(int64(jitterSum / float64(len(pings))))

	return BurstResult{
		Pings:       pings,
		AveragePing: avg,
		Jitter:      jitter,
		PacketLoss:  packetLoss,
		Success:     len(pings) > 0,
	}
}
