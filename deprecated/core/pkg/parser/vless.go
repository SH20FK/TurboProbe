package parser

import (
	"crypto/md5"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// ParseVLESS parses a standard vless:// URI
// Format: vless://uuid@server:port?type=...&security=...&sni=...#name
func ParseVLESS(raw string) (*NodeConfig, error) {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse vless url: %w", err)
	}

	if u.Scheme != "vless" {
		return nil, fmt.Errorf("invalid scheme: %s", u.Scheme)
	}

	uuid := u.User.Username()
	server := u.Hostname()
	portStr := u.Port()
	port, err := strconv.Atoi(portStr)
	if err != nil {
		port = 443 // default
	}

	q := u.Query()
	name := u.Fragment
	if name == "" {
		name = fmt.Sprintf("VLESS-%s:%d", server, port)
	} else {
		if unescaped, err := url.QueryUnescape(name); err == nil {
			name = unescaped
		}
	}

	var alpn []string
	if q.Get("alpn") != "" {
		alpn = strings.Split(q.Get("alpn"), ",")
	}

	id := fmt.Sprintf("%x", md5.Sum([]byte(raw)))[:12]

	node := &NodeConfig{
		ID:          id,
		RawURI:      raw,
		Protocol:    ProtoVLESS,
		Name:        name,
		Server:      server,
		Port:        port,
		UUID:        uuid,
		Security:    q.Get("security"),
		SNI:         q.Get("sni"),
		Host:        q.Get("host"),
		Path:        q.Get("path"),
		Type:        q.Get("type"),
		PBK:         q.Get("pbk"),
		SID:         q.Get("sid"),
		SpiderX:     q.Get("spx"),
		Flow:        q.Get("flow"),
		Fingerprint: q.Get("fp"),
		Alpn:        alpn,
		Insecure:    q.Get("allowInsecure") == "1" || q.Get("insecure") == "1",
		Extra:       make(map[string]string),
	}

	if node.SNI == "" && node.Host != "" {
		node.SNI = node.Host
	}

	for k, v := range q {
		if len(v) > 0 {
			node.Extra[k] = v[0]
		}
	}

	return node, nil
}
