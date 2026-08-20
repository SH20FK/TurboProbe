package parser

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type vmessJSON struct {
	V    interface{} `json:"v"`
	PS   string      `json:"ps"`
	Add  string      `json:"add"`
	Port interface{} `json:"port"`
	ID   string      `json:"id"`
	Aid  interface{} `json:"aid"`
	Scy  string      `json:"scy"`
	Net  string      `json:"net"`
	Type string      `json:"type"`
	Host string      `json:"host"`
	Path string      `json:"path"`
	TLS  string      `json:"tls"`
	SNI  string      `json:"sni"`
	Alpn string      `json:"alpn"`
	Fp   string      `json:"fp"`
}

// ParseVMess parses vmess://<base64-json>
func ParseVMess(raw string) (*NodeConfig, error) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "vmess://") {
		return nil, fmt.Errorf("invalid vmess scheme")
	}

	b64Part := strings.TrimPrefix(raw, "vmess://")
	// Add padding if missing
	if pad := len(b64Part) % 4; pad != 0 {
		b64Part += strings.Repeat("=", 4-pad)
	}

	data, err := base64.StdEncoding.DecodeString(b64Part)
	if err != nil {
		data, err = base64.URLEncoding.DecodeString(b64Part)
		if err != nil {
			return nil, fmt.Errorf("failed to decode vmess base64: %w", err)
		}
	}

	var vj vmessJSON
	if err := json.Unmarshal(data, &vj); err != nil {
		return nil, fmt.Errorf("failed to parse vmess json: %w", err)
	}

	var port int
	switch p := vj.Port.(type) {
	case float64:
		port = int(p)
	case string:
		port, _ = strconv.Atoi(p)
	default:
		port = 443
	}

	name := vj.PS
	if name == "" {
		name = fmt.Sprintf("VMess-%s:%d", vj.Add, port)
	}

	var alpn []string
	if vj.Alpn != "" {
		alpn = strings.Split(vj.Alpn, ",")
	}

	id := fmt.Sprintf("%x", md5.Sum([]byte(raw)))[:12]

	security := vj.TLS
	if security == "" && vj.Scy != "" {
		security = vj.Scy
	}

	node := &NodeConfig{
		ID:          id,
		RawURI:      raw,
		Protocol:    ProtoVMess,
		Name:        name,
		Server:      vj.Add,
		Port:        port,
		UUID:        vj.ID,
		Security:    security,
		SNI:         vj.SNI,
		Host:        vj.Host,
		Path:        vj.Path,
		Type:        vj.Net,
		Fingerprint: vj.Fp,
		Alpn:        alpn,
		Extra:       make(map[string]string),
	}

	if node.SNI == "" && node.Host != "" {
		node.SNI = node.Host
	}

	return node, nil
}
