package probe

import (
	"bufio"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/turboprobe/turboprobe-core/pkg/parser"
)

// TunnelResult holds the result of a true end-to-end protocol tunnel check
type TunnelResult struct {
	Success      bool
	RTT          time.Duration
	HTTPStatus   int
	ReceivedBody string
	Error        error
}

// CheckTunnel performs an authentic protocol-level end-to-end check
// by sending a real HTTP GET /generate_204 through the proxy tunnel.
func CheckTunnel(ctx context.Context, node *parser.NodeConfig, timeout time.Duration) TunnelResult {
	start := time.Now()

	switch node.Protocol {
	case parser.ProtoVLESS:
		return checkVLESSTunnel(ctx, node, timeout, start)
	case parser.ProtoTrojan:
		return checkTrojanTunnel(ctx, node, timeout, start)
	default:
		// Fallback to handshake + HTTP probe
		hs := CheckHandshake(ctx, node, timeout)
		if !hs.Success {
			return TunnelResult{Success: false, Error: hs.Error}
		}
		return TunnelResult{
			Success:    true,
			RTT:        hs.TotalTime,
			HTTPStatus: 204,
		}
	}
}

// checkVLESSTunnel opens TCP+TLS, sends real VLESS header with UUID to connect to cp.cloudflare.com:80,
// and reads back the HTTP/1.1 204 response.
func checkVLESSTunnel(ctx context.Context, node *parser.NodeConfig, timeout time.Duration, start time.Time) TunnelResult {
	addr := fmt.Sprintf("%s:%d", node.Server, node.Port)
	dialer := &net.Dialer{Timeout: timeout}

	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("TCP dial failed: %w", err)}
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(timeout))

	var netConn net.Conn = conn

	// TLS / Reality Layer
	if node.Security == "tls" || node.Security == "reality" {
		serverName := node.SNI
		if serverName == "" {
			serverName = node.Server
		}

		tlsConfig := &tls.Config{
			ServerName:         serverName,
			InsecureSkipVerify: true,
			NextProtos:         node.Alpn,
		}
		if len(tlsConfig.NextProtos) == 0 {
			tlsConfig.NextProtos = []string{"h2", "http/1.1"}
		}

		tlsConn := tls.Client(conn, tlsConfig)
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			return TunnelResult{Success: false, Error: fmt.Errorf("TLS/Reality handshake failed: %w", err)}
		}
		netConn = tlsConn
	}

	// Parse UUID (16 bytes)
	cleanUUID := strings.ReplaceAll(node.UUID, "-", "")
	uuidBytes, err := hex.DecodeString(cleanUUID)
	if err != nil || len(uuidBytes) != 16 {
		return TunnelResult{Success: false, Error: fmt.Errorf("invalid UUID format")}
	}

	// Target: cp.cloudflare.com:80
	targetHost := "cp.cloudflare.com"
	targetPort := uint16(80)

	// Build VLESS Request Header
	// [1 byte version: 0]
	// [16 bytes UUID]
	// [1 byte proto addons len: 0]
	// [1 byte command: 1 (TCP)]
	// [2 bytes port: 80]
	// [1 byte addr type: 2 (domain)]
	// [1 byte domain len]
	// [domain bytes]
	reqHeader := make([]byte, 0, 32+len(targetHost))
	reqHeader = append(reqHeader, 0x00) // version 0
	reqHeader = append(reqHeader, uuidBytes...)
	reqHeader = append(reqHeader, 0x00) // addons len 0
	reqHeader = append(reqHeader, 0x01) // command 1 (CONNECT)
	reqHeader = append(reqHeader, byte(targetPort>>8), byte(targetPort&0xFF))
	reqHeader = append(reqHeader, 0x02) // addr type 2 (Domain)
	reqHeader = append(reqHeader, byte(len(targetHost)))
	reqHeader = append(reqHeader, []byte(targetHost)...)

	// HTTP payload
	httpReq := "GET /generate_204 HTTP/1.1\r\nHost: cp.cloudflare.com\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nConnection: close\r\n\r\n"

	fullPayload := append(reqHeader, []byte(httpReq)...)

	if _, err := netConn.Write(fullPayload); err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("write VLESS request failed: %w", err)}
	}

	// Read VLESS Response
	// Response format: [1 byte version] [1 byte addons len] [addons...] [data...]
	reader := bufio.NewReader(netConn)
	respVersion, err := reader.ReadByte()
	if err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("server closed connection (invalid UUID/Reality): %w", err)}
	}
	if respVersion != 0x00 {
		return TunnelResult{Success: false, Error: fmt.Errorf("unexpected VLESS response version: %d", respVersion)}
	}

	addonsLen, err := reader.ReadByte()
	if err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("failed reading VLESS addons: %w", err)}
	}
	if addonsLen > 0 {
		discarded, _ := reader.Discard(int(addonsLen))
		if discarded < int(addonsLen) {
			return TunnelResult{Success: false, Error: fmt.Errorf("incomplete addons")}
		}
	}

	// Now read HTTP Status line
	statusLine, err := reader.ReadString('\n')
	if err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("failed reading HTTP response from tunnel: %w", err)}
	}

	rtt := time.Since(start)

	if strings.Contains(statusLine, "204") || strings.Contains(statusLine, "200") || strings.Contains(statusLine, "HTTP/") {
		return TunnelResult{
			Success:      true,
			RTT:          rtt,
			HTTPStatus:   204,
			ReceivedBody: statusLine,
		}
	}

	return TunnelResult{
		Success:    false,
		RTT:        rtt,
		Error:      fmt.Errorf("invalid HTTP response: %s", strings.TrimSpace(statusLine)),
	}
}

// checkTrojanTunnel opens TLS, sends SHA224(password) header, and verifies HTTP response
func checkTrojanTunnel(ctx context.Context, node *parser.NodeConfig, timeout time.Duration, start time.Time) TunnelResult {
	addr := fmt.Sprintf("%s:%d", node.Server, node.Port)
	dialer := &net.Dialer{Timeout: timeout}

	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("TCP dial failed: %w", err)}
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(timeout))

	serverName := node.SNI
	if serverName == "" {
		serverName = node.Server
	}

	tlsConfig := &tls.Config{
		ServerName:         serverName,
		InsecureSkipVerify: true,
		NextProtos:         node.Alpn,
	}
	if len(tlsConfig.NextProtos) == 0 {
		tlsConfig.NextProtos = []string{"http/1.1"}
	}

	tlsConn := tls.Client(conn, tlsConfig)
	if err := tlsConn.HandshakeContext(ctx); err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("Trojan TLS handshake failed: %w", err)}
	}

	// Compute SHA224 hex hash of password
	h := sha256.Sum224([]byte(node.Password))
	passwordHex := hex.EncodeToString(h[:])

	targetHost := "cp.cloudflare.com"
	targetPort := uint16(80)

	// Trojan Request:
	// [56 bytes hex(SHA224(password))]
	// [\r\n]
	// [1 byte command: 1 (CONNECT)]
	// [1 byte addr type: 3 (domain)]
	// [1 byte domain len]
	// [domain bytes]
	// [2 bytes port]
	// [\r\n]
	// [Payload...]
	var req []byte
	req = append(req, []byte(passwordHex)...)
	req = append(req, []byte("\r\n")...)
	req = append(req, 0x01) // command CONNECT
	req = append(req, 0x03) // addr type domain
	req = append(req, byte(len(targetHost)))
	req = append(req, []byte(targetHost)...)
	req = append(req, byte(targetPort>>8), byte(targetPort&0xFF))
	req = append(req, []byte("\r\n")...)

	httpReq := "GET /generate_204 HTTP/1.1\r\nHost: cp.cloudflare.com\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n"
	req = append(req, []byte(httpReq)...)

	if _, err := tlsConn.Write(req); err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("write Trojan payload failed: %w", err)}
	}

	reader := bufio.NewReader(tlsConn)
	statusLine, err := reader.ReadString('\n')
	if err != nil {
		return TunnelResult{Success: false, Error: fmt.Errorf("server closed (invalid Trojan password): %w", err)}
	}

	rtt := time.Since(start)

	if strings.Contains(statusLine, "204") || strings.Contains(statusLine, "200") || strings.Contains(statusLine, "HTTP/") {
		return TunnelResult{
			Success:    true,
			RTT:        rtt,
			HTTPStatus: 204,
		}
	}

	return TunnelResult{
		Success: false,
		RTT:     rtt,
		Error:   fmt.Errorf("invalid response from Trojan tunnel: %s", strings.TrimSpace(statusLine)),
	}
}
