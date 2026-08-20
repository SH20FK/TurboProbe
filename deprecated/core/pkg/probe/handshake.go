package probe

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"time"

	"github.com/turboprobe/turboprobe-core/pkg/parser"
)

// HandshakeResult represents the result of the initial protocol handshake
type HandshakeResult struct {
	Success     bool
	TCPTime     time.Duration
	TLSTime     time.Duration
	TotalTime   time.Duration
	ResolvedIP  string
	Error       error
}

// CheckHandshake tests low-level TCP/TLS connectivity to verify if ISP/DPI is blocking the node
func CheckHandshake(ctx context.Context, node *parser.NodeConfig, timeout time.Duration) HandshakeResult {
	addr := fmt.Sprintf("%s:%d", node.Server, node.Port)
	dialer := &net.Dialer{
		Timeout: timeout,
	}

	start := time.Now()
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return HandshakeResult{
			Success: false,
			Error:   fmt.Errorf("TCP dial failed: %w", err),
		}
	}
	defer conn.Close()

	tcpDuration := time.Since(start)
	remoteIP := conn.RemoteAddr().String()

	// If protocol uses TLS / Reality / Trojan / VMess TLS / VLESS Reality
	if node.Security == "tls" || node.Security == "reality" || node.Protocol == parser.ProtoTrojan {
		tlsStart := time.Now()
		serverName := node.SNI
		if serverName == "" {
			serverName = node.Server
		}

		tlsConfig := &tls.Config{
			ServerName:         serverName,
			InsecureSkipVerify: true, // we want to verify handshake completion, not CA chain for reality/self-signed
			NextProtos:         node.Alpn,
		}
		if len(tlsConfig.NextProtos) == 0 {
			tlsConfig.NextProtos = []string{"h2", "http/1.1"}
		}

		tlsConn := tls.Client(conn, tlsConfig)
		_ = tlsConn.SetDeadline(time.Now().Add(timeout))

		if err := tlsConn.HandshakeContext(ctx); err != nil {
			return HandshakeResult{
				Success:    false,
				TCPTime:    tcpDuration,
				ResolvedIP: remoteIP,
				Error:      fmt.Errorf("TLS handshake failed (possible DPI block): %w", err),
			}
		}

		tlsDuration := time.Since(tlsStart)
		return HandshakeResult{
			Success:    true,
			TCPTime:    tcpDuration,
			TLSTime:    tlsDuration,
			TotalTime:  time.Since(start),
			ResolvedIP: remoteIP,
		}
	}

	return HandshakeResult{
		Success:    true,
		TCPTime:    tcpDuration,
		TotalTime:  tcpDuration,
		ResolvedIP: remoteIP,
	}
}
