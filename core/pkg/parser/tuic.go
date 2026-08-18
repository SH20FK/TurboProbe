package parser

import (
	"crypto/md5"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// ParseTUIC parses tuic:// URIs
// Format: tuic://uuid:password@server:port?congestion_control=bbr&sni=...#name
func ParseTUIC(raw string) (*NodeConfig, error) {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to parse tuic url: %w", err)
	}

	if u.Scheme != "tuic" {
		return nil, fmt.Errorf("invalid tuic scheme")
	}

	uuid := u.User.Username()
	password, _ := u.User.Password()
	server := u.Hostname()
	portStr := u.Port()
	port, err := strconv.Atoi(portStr)
	if err != nil {
		port = 443
	}

	q := u.Query()
	name := u.Fragment
	if name == "" {
		name = fmt.Sprintf("TUIC-%s:%d", server, port)
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

	sni := q.Get("sni")
	if sni == "" {
		sni = server
	}

	node := &NodeConfig{
		ID:          id,
		RawURI:      raw,
		Protocol:    ProtoTUIC,
		Name:        name,
		Server:      server,
		Port:        port,
		UUID:        uuid,
		Password:    password,
		Security:    "tls",
		SNI:         sni,
		Alpn:        alpn,
		Insecure:    q.Get("allow_insecure") == "1" || q.Get("insecure") == "1",
		Extra:       make(map[string]string),
	}

	for k, v := range q {
		if len(v) > 0 {
			node.Extra[k] = v[0]
		}
	}

	return node, nil
}
