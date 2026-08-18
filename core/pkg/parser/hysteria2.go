package parser

import (
	"crypto/md5"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// ParseHysteria2 parses hysteria2:// or hy2:// URIs
func ParseHysteria2(raw string) (*NodeConfig, error) {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse hysteria2 url: %w", err)
	}

	if u.Scheme != "hysteria2" && u.Scheme != "hy2" && u.Scheme != "hysteria" {
		return nil, fmt.Errorf("invalid hysteria2 scheme")
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
		name = fmt.Sprintf("Hysteria2-%s:%d", server, port)
	} else {
		if unescaped, err := url.QueryUnescape(name); err == nil {
			name = unescaped
		}
	}

	id := fmt.Sprintf("%x", md5.Sum([]byte(raw)))[:12]

	sni := q.Get("sni")
	if sni == "" {
		sni = q.Get("peer")
	}
	if sni == "" {
		sni = server
	}

	node := &NodeConfig{
		ID:          id,
		RawURI:      raw,
		Protocol:    ProtoHysteria2,
		Name:        name,
		Server:      server,
		Port:        port,
		Password:    password,
		Security:    "tls",
		SNI:         sni,
		Host:        q.Get("host"),
		Insecure:    q.Get("insecure") == "1",
		Extra:       make(map[string]string),
	}

	for k, v := range q {
		if len(v) > 0 {
			node.Extra[k] = v[0]
		}
	}

	return node, nil
}
