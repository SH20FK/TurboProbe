package parser

import (
	"crypto/md5"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// ParseTrojan parses trojan:// URIs
func ParseTrojan(raw string) (*NodeConfig, error) {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse trojan url: %w", err)
	}

	if u.Scheme != "trojan" {
		return nil, fmt.Errorf("invalid trojan scheme")
	}

	password := u.User.Username()
	server := u.Hostname()
	portStr := u.Port()
	port, err := strconv.Atoi(portStr)
	if err != nil {
		port = 443
	}

	q := u.Query()
	name := u.Fragment
	if name == "" {
		name = fmt.Sprintf("Trojan-%s:%d", server, port)
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
		Protocol:    ProtoTrojan,
		Name:        name,
		Server:      server,
		Port:        port,
		Password:    password,
		Security:    "tls",
		SNI:         q.Get("sni"),
		Host:        q.Get("host"),
		Path:        q.Get("path"),
		Type:        q.Get("type"),
		Fingerprint: q.Get("fp"),
		Alpn:        alpn,
		Insecure:    q.Get("allowInsecure") == "1" || q.Get("insecure") == "1",
		Extra:       make(map[string]string),
	}

	if node.SNI == "" && node.Host != "" {
		node.SNI = node.Host
	}

	return node, nil
}
