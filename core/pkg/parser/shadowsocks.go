package parser

import (
	"crypto/md5"
	"encoding/base64"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// ParseShadowsocks parses ss:// URIs in standard and legacy formats
func ParseShadowsocks(raw string) (*NodeConfig, error) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "ss://") {
		return nil, fmt.Errorf("invalid ss scheme")
	}

	body := strings.TrimPrefix(raw, "ss://")
	var name string
	if idx := strings.Index(body, "#"); idx != -1 {
		name = body[idx+1:]
		body = body[:idx]
		if unescaped, err := url.QueryUnescape(name); err == nil {
			name = unescaped
		}
	}

	var method, password, server string
	var port int

	// Check if entire userInfo@server:port is base64 encoded
	if !strings.Contains(body, "@") {
		decoded, err := decodeBase64Padded(body)
		if err == nil && strings.Contains(string(decoded), "@") {
			body = string(decoded)
		}
	}

	if strings.Contains(body, "@") {
		parts := strings.SplitN(body, "@", 2)
		userPart := parts[0]
		serverPart := parts[1]

		// userPart might be base64 encoded method:password
		if decoded, err := decodeBase64Padded(userPart); err == nil {
			userPart = string(decoded)
		}

		if colonIdx := strings.Index(userPart, ":"); colonIdx != -1 {
			method = userPart[:colonIdx]
			password = userPart[colonIdx+1:]
		}

		// Parse server:port and possible query params
		if queryIdx := strings.Index(serverPart, "/?"); queryIdx != -1 {
			serverPart = serverPart[:queryIdx]
		} else if queryIdx := strings.Index(serverPart, "?"); queryIdx != -1 {
			serverPart = serverPart[:queryIdx]
		}

		if host, pStr, err := splitHostPort(serverPart); err == nil {
			server = host
			port, _ = strconv.Atoi(pStr)
		}
	}

	if server == "" || port == 0 {
		return nil, fmt.Errorf("failed to parse shadowsocks address")
	}

	if name == "" {
		name = fmt.Sprintf("SS-%s:%d", server, port)
	}

	id := fmt.Sprintf("%x", md5.Sum([]byte(raw)))[:12]

	return &NodeConfig{
		ID:       id,
		RawURI:   raw,
		Protocol: ProtoShadowsocks,
		Name:     name,
		Server:   server,
		Port:     port,
		Method:   method,
		Password: password,
		Extra:    make(map[string]string),
	}, nil
}

func decodeBase64Padded(s string) ([]byte, error) {
	if pad := len(s) % 4; pad != 0 {
		s += strings.Repeat("=", 4-pad)
	}
	data, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		data, err = base64.URLEncoding.DecodeString(s)
	}
	return data, err
}

func splitHostPort(hostport string) (string, string, error) {
	hostport = strings.TrimSpace(hostport)
	if strings.HasPrefix(hostport, "[") {
		// IPv6
		end := strings.Index(hostport, "]")
		if end == -1 {
			return "", "", fmt.Errorf("invalid ipv6")
		}
		host := hostport[1:end]
		port := ""
		if len(hostport) > end+1 && hostport[end+1] == ':' {
			port = hostport[end+2:]
		}
		return host, port, nil
	}

	parts := strings.Split(hostport, ":")
	if len(parts) >= 2 {
		return parts[0], parts[len(parts)-1], nil
	}
	return parts[0], "", nil
}
