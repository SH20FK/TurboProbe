package parser

import (
	"fmt"
	"strings"
	"time"
)

// ProtocolType represents supported VPN protocols
type ProtocolType string

const (
	ProtoVLESS       ProtocolType = "vless"
	ProtoVMess       ProtocolType = "vmess"
	ProtoShadowsocks ProtocolType = "shadowsocks"
	ProtoTrojan      ProtocolType = "trojan"
	ProtoHysteria2   ProtocolType = "hysteria2"
	ProtoTUIC        ProtocolType = "tuic"
	ProtoWireGuard   ProtocolType = "wireguard"
	ProtoUnknown     ProtocolType = "unknown"
)

// NodeConfig represents a parsed universal VPN node configuration
type NodeConfig struct {
	ID          string            `json:"id"`
	RawURI      string            `json:"raw_uri"`
	Protocol    ProtocolType      `json:"protocol"`
	Name        string            `json:"name"`
	Server      string            `json:"server"`
	Port        int               `json:"port"`
	UUID        string            `json:"uuid,omitempty"`
	Password    string            `json:"password,omitempty"`
	Method      string            `json:"method,omitempty"` // For SS / Shadowsocks
	Security    string            `json:"security,omitempty"` // tls, reality, none
	SNI         string            `json:"sni,omitempty"`
	Host        string            `json:"host,omitempty"`
	Path        string            `json:"path,omitempty"`
	Type        string            `json:"type,omitempty"` // ws, grpc, tcp, http, h2, quic
	PBK         string            `json:"pbk,omitempty"`  // Reality public key
	SID         string            `json:"sid,omitempty"`  // Reality short ID
	SpiderX     string            `json:"spider_x,omitempty"`
	Flow        string            `json:"flow,omitempty"` // xtls-rprx-vision
	Fingerprint string            `json:"fingerprint,omitempty"` // chrome, firefox, ios, etc.
	Alpn        []string          `json:"alpn,omitempty"`
	Insecure    bool              `json:"insecure,omitempty"`
	Extra       map[string]string `json:"extra,omitempty"`

	// Geo & Probe metrics
	CountryCode string    `json:"country_code,omitempty"`
	CountryName string    `json:"country_name,omitempty"`
	City        string    `json:"city,omitempty"`
	FlagEmoji   string    `json:"flag_emoji,omitempty"`
	ISP         string    `json:"isp,omitempty"`
	IsAlive     bool      `json:"is_alive"`
	PingMs      int64     `json:"ping_ms"`       // Real HTTP RTT in milliseconds
	JitterMs    int64     `json:"jitter_ms"`     // Jitter variance across burst
	PacketLoss  float64   `json:"packet_loss"`   // 0.0 to 1.0 (e.g. 0% - 100%)
	HTTPStatus  int       `json:"http_status"`   // 200, 204, etc.
	TestedAt    time.Time `json:"tested_at"`
	ErrorMsg    string    `json:"error_msg,omitempty"`
	Score       int       `json:"score"`         // Calculated quality score 0-100

	// RU-Specific Unlock Badges & Anti-TSPU Metrics
	UnlockYouTube   bool `json:"unlock_youtube"`
	UnlockDiscord   bool `json:"unlock_discord"`
	UnlockOpenAI    bool `json:"unlock_openai"`
	UnlockTelegram  bool `json:"unlock_telegram"`
	UnlockInstagram bool `json:"unlock_instagram"`
	IsTSPUResistant bool `json:"is_tspu_resistant"`
}

// FingerprintKey returns a unique hashable string to identify duplicates
func (n *NodeConfig) FingerprintKey() string {
	return fmt.Sprintf("%s://%s:%d@%s-%s-%s", n.Protocol, n.Server, n.Port, n.UUID, n.Password, n.SNI)
}

// PrettyName generates a clean, advertisement-free title with flag and stats
func (n *NodeConfig) PrettyName() string {
	flag := n.FlagEmoji
	if flag == "" {
		flag = "🌐"
	}

	country := n.CountryName
	if country == "" {
		country = n.CountryCode
	}
	if country == "" {
		country = "Node"
	}

	proto := strings.ToUpper(string(n.Protocol))
	if n.Security == "reality" {
		proto = "Reality"
	}

	var tags []string
	if n.UnlockYouTube {
		tags = append(tags, "YT 4K")
	}
	if n.UnlockDiscord {
		tags = append(tags, "Discord")
	}
	if n.UnlockOpenAI {
		tags = append(tags, "AI")
	}

	tagStr := ""
	if len(tags) > 0 {
		tagStr = fmt.Sprintf(" [%s]", strings.Join(tags, " • "))
	}

	return fmt.Sprintf("%s %s • %dms • %s%s", flag, country, n.PingMs, proto, tagStr)
}
