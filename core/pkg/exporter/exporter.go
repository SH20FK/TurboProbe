package exporter

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/turboprobe/turboprobe-core/pkg/parser"
)

type ExportFormat string

const (
	FormatRawURIs   ExportFormat = "raw"
	FormatBase64    ExportFormat = "base64"
	FormatClashYAML ExportFormat = "clash"
	FormatSingBox   ExportFormat = "singbox"
)

// FilterOptions configures which nodes to include in the export
type FilterOptions struct {
	OnlyAlive   bool     `json:"only_alive"`
	MaxPingMs   int64    `json:"max_ping_ms"`
	Limit       int      `json:"limit"`
	Protocols   []string `json:"protocols"`
	Countries   []string `json:"countries"`
}

// Export processes the nodes according to filters and generates the specified format
func Export(nodes []*parser.NodeConfig, format ExportFormat, opts FilterOptions) (string, int) {
	filtered := filterNodes(nodes, opts)
	count := len(filtered)

	switch format {
	case FormatBase64:
		var uris []string
		for _, n := range filtered {
			uris = append(uris, n.RawURI)
		}
		raw := strings.Join(uris, "\n")
		return base64.StdEncoding.EncodeToString([]byte(raw)), count

	case FormatClashYAML:
		return exportClashYAML(filtered), count

	case FormatSingBox:
		return exportSingBoxJSON(filtered), count

	case FormatRawURIs:
		fallthrough
	default:
		var uris []string
		for _, n := range filtered {
			uris = append(uris, n.RawURI)
		}
		return strings.Join(uris, "\n"), count
	}
}

func filterNodes(nodes []*parser.NodeConfig, opts FilterOptions) []*parser.NodeConfig {
	var result []*parser.NodeConfig

	protoMap := make(map[string]bool)
	for _, p := range opts.Protocols {
		protoMap[strings.ToLower(p)] = true
	}

	countryMap := make(map[string]bool)
	for _, c := range opts.Countries {
		countryMap[strings.ToUpper(c)] = true
	}

	for _, n := range nodes {
		if opts.OnlyAlive && !n.IsAlive {
			continue
		}
		if opts.MaxPingMs > 0 && n.PingMs > opts.MaxPingMs {
			continue
		}
		if len(protoMap) > 0 && !protoMap[string(n.Protocol)] {
			continue
		}
		if len(countryMap) > 0 && !countryMap[strings.ToUpper(n.CountryCode)] {
			continue
		}

		result = append(result, n)

		if opts.Limit > 0 && len(result) >= opts.Limit {
			break
		}
	}

	return result
}

func exportClashYAML(nodes []*parser.NodeConfig) string {
	var sb strings.Builder
	sb.WriteString("port: 7890\nsocks-port: 7891\nallow-lan: false\nmode: rule\nlog-level: info\n\nproxies:\n")

	var proxyNames []string
	for _, n := range nodes {
		safeName := strings.ReplaceAll(n.Name, ":", "-")
		proxyNames = append(proxyNames, safeName)

		switch n.Protocol {
		case parser.ProtoVLESS:
			sb.WriteString(fmt.Sprintf("  - name: \"%s\"\n", safeName))
			sb.WriteString(fmt.Sprintf("    type: vless\n    server: %s\n    port: %d\n    uuid: %s\n    network: %s\n", n.Server, n.Port, n.UUID, getClashNetwork(n.Type)))
			if n.Security == "reality" {
				sb.WriteString(fmt.Sprintf("    tls: true\n    servername: %s\n    reality-opts:\n      public-key: %s\n      short-id: %s\n", n.SNI, n.PBK, n.SID))
				if n.Flow != "" {
					sb.WriteString(fmt.Sprintf("    flow: %s\n", n.Flow))
				}
			} else if n.Security == "tls" {
				sb.WriteString(fmt.Sprintf("    tls: true\n    servername: %s\n", n.SNI))
			}

		case parser.ProtoShadowsocks:
			sb.WriteString(fmt.Sprintf("  - name: \"%s\"\n", safeName))
			sb.WriteString(fmt.Sprintf("    type: ss\n    server: %s\n    port: %d\n    cipher: %s\n    password: \"%s\"\n", n.Server, n.Port, n.Method, n.Password))

		case parser.ProtoTrojan:
			sb.WriteString(fmt.Sprintf("  - name: \"%s\"\n", safeName))
			sb.WriteString(fmt.Sprintf("    type: trojan\n    server: %s\n    port: %d\n    password: \"%s\"\n    sni: %s\n", n.Server, n.Port, n.Password, n.SNI))

		case parser.ProtoHysteria2:
			sb.WriteString(fmt.Sprintf("  - name: \"%s\"\n", safeName))
			sb.WriteString(fmt.Sprintf("    type: hysteria2\n    server: %s\n    port: %d\n    password: \"%s\"\n    sni: %s\n", n.Server, n.Port, n.Password, n.SNI))

		case parser.ProtoVMess:
			sb.WriteString(fmt.Sprintf("  - name: \"%s\"\n", safeName))
			sb.WriteString(fmt.Sprintf("    type: vmess\n    server: %s\n    port: %d\n    uuid: %s\n    alterId: 0\n    cipher: auto\n    network: %s\n", n.Server, n.Port, n.UUID, getClashNetwork(n.Type)))
			if n.Security == "tls" {
				sb.WriteString(fmt.Sprintf("    tls: true\n    servername: %s\n", n.SNI))
			}
		}
	}

	sb.WriteString("\nproxy-groups:\n  - name: PROXY\n    type: select\n    proxies:\n")
	for _, name := range proxyNames {
		sb.WriteString(fmt.Sprintf("      - \"%s\"\n", name))
	}

	sb.WriteString("\nrules:\n  - MATCH,PROXY\n")
	return sb.String()
}

func getClashNetwork(t string) string {
	if t == "ws" || t == "grpc" || t == "http" || t == "h2" {
		return t
	}
	return "tcp"
}

func exportSingBoxJSON(nodes []*parser.NodeConfig) string {
	type SingBoxOutbound struct {
		Type       string                 `json:"type"`
		Tag        string                 `json:"tag"`
		Server     string                 `json:"server,omitempty"`
		ServerPort int                    `json:"server_port,omitempty"`
		UUID       string                 `json:"uuid,omitempty"`
		Password   string                 `json:"password,omitempty"`
		Method     string                 `json:"method,omitempty"`
		TLS        map[string]interface{} `json:"tls,omitempty"`
		Transport  map[string]interface{} `json:"transport,omitempty"`
	}

	var outbounds []SingBoxOutbound
	var tags []string

	for _, n := range nodes {
		safeTag := n.Name
		tags = append(tags, safeTag)

		ob := SingBoxOutbound{
			Type:       string(n.Protocol),
			Tag:        safeTag,
			Server:     n.Server,
			ServerPort: n.Port,
			UUID:       n.UUID,
			Password:   n.Password,
			Method:     n.Method,
		}

		if n.Security == "tls" || n.Security == "reality" {
			tlsMap := map[string]interface{}{
				"enabled":     true,
				"server_name": n.SNI,
			}
			if n.Security == "reality" {
				tlsMap["reality"] = map[string]interface{}{
					"enabled":    true,
					"public_key": n.PBK,
					"short_id":   n.SID,
				}
			}
			ob.TLS = tlsMap
		}

		outbounds = append(outbounds, ob)
	}

	config := map[string]interface{}{
		"outbounds": outbounds,
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(data)
}
