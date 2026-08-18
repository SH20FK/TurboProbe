package probe

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httptrace"
	"time"

	"github.com/turboprobe/turboprobe-core/pkg/parser"
)

// HTTPProbeResult contains timing and status from an HTTP request
type HTTPProbeResult struct {
	Success      bool
	StatusCode   int
	DNSDuration  time.Duration
	ConnDuration time.Duration
	TLSDuration  time.Duration
	TTFB         time.Duration
	TotalLatency time.Duration
	Error        error
}

// CheckHTTP performs an HTTP/HTTPS probe with high-resolution latency tracking
func CheckHTTP(ctx context.Context, node *parser.NodeConfig, targetURL string, timeout time.Duration) HTTPProbeResult {
	if targetURL == "" {
		targetURL = "http://cp.cloudflare.com/generate_204"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return HTTPProbeResult{
			Success: false,
			Error:   fmt.Errorf("invalid target request: %w", err),
		}
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	var (
		dnsStart, connStart, tlsStart, reqStart, ttfbStart time.Time
		dnsDur, connDur, tlsDur, ttfbDur                   time.Duration
	)

	trace := &httptrace.ClientTrace{
		DNSStart: func(_ httptrace.DNSStartInfo) { dnsStart = time.Now() },
		DNSDone:  func(_ httptrace.DNSDoneInfo) { dnsDur = time.Since(dnsStart) },
		ConnectStart: func(_, _ string) { connStart = time.Now() },
		ConnectDone: func(_, _ string, _ error) { connDur = time.Since(connStart) },
		TLSHandshakeStart: func() { tlsStart = time.Now() },
		TLSHandshakeDone:  func(_ tls.ConnectionState, _ error) { tlsDur = time.Since(tlsStart) },
		WroteRequest:      func(_ httptrace.WroteRequestInfo) { ttfbStart = time.Now() },
		GotFirstResponseByte: func() { ttfbDur = time.Since(ttfbStart) },
	}

	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // don't follow redirects to keep raw response time
		},
	}

	reqStart = time.Now()
	resp, err := client.Do(req)
	total := time.Since(reqStart)

	if err != nil {
		return HTTPProbeResult{
			Success:      false,
			TotalLatency: total,
			Error:        err,
		}
	}
	defer resp.Body.Close()

	if ttfbDur == 0 {
		ttfbDur = total
	}

	return HTTPProbeResult{
		Success:      resp.StatusCode >= 200 && resp.StatusCode < 400,
		StatusCode:   resp.StatusCode,
		DNSDuration:  dnsDur,
		ConnDuration: connDur,
		TLSDuration:  tlsDur,
		TTFB:         ttfbDur,
		TotalLatency: total,
	}
}
