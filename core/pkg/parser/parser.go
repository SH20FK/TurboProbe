package parser

import (
	"bufio"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ParseInput takes raw string input (single key, multiline, base64 blob, or subscription URL)
// and returns a deduplicated list of NodeConfigs.
func ParseInput(ctx context.Context, input string) ([]*NodeConfig, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, fmt.Errorf("empty input provided")
	}

	// 1. If input is a subscription URL, fetch it
	if strings.HasPrefix(input, "http://") || strings.HasPrefix(input, "https://") {
		// If single line URL
		if !strings.Contains(input, "\n") {
			content, err := fetchSubscription(ctx, input)
			if err != nil {
				return nil, fmt.Errorf("failed to fetch subscription: %w", err)
			}
			input = content
		}
	}

	// 2. Try Base64 decoding if the whole text or lines look like base64
	lines := extractLines(input)
	var allURIs []string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "#") {
			continue
		}

		if isSupportedScheme(line) {
			allURIs = append(allURIs, line)
			continue
		}

		// Try decoding as base64 block
		decoded, err := tryDecodeBase64(line)
		if err == nil && len(decoded) > 0 {
			subLines := extractLines(string(decoded))
			for _, subLine := range subLines {
				subLine = strings.TrimSpace(subLine)
				if isSupportedScheme(subLine) {
					allURIs = append(allURIs, subLine)
				}
			}
		}
	}

	// If no valid URIs found directly, try decoding the whole raw input as one big base64 block
	if len(allURIs) == 0 {
		decoded, err := tryDecodeBase64(input)
		if err == nil {
			subLines := extractLines(string(decoded))
			for _, subLine := range subLines {
				subLine = strings.TrimSpace(subLine)
				if isSupportedScheme(subLine) {
					allURIs = append(allURIs, subLine)
				}
			}
		}
	}

	// 3. Parse individual URIs and deduplicate
	var nodes []*NodeConfig
	seenFingerprints := make(map[string]bool)

	for _, uri := range allURIs {
		node, err := ParseURI(uri)
		if err != nil {
			continue // skip malformed keys
		}

		fp := node.FingerprintKey()
		if seenFingerprints[fp] {
			continue // skip duplicates
		}
		seenFingerprints[fp] = true

		nodes = append(nodes, node)
	}

	return nodes, nil
}

// ParseURI routes a URI string to its specific protocol parser
func ParseURI(uri string) (*NodeConfig, error) {
	uri = strings.TrimSpace(uri)
	switch {
	case strings.HasPrefix(uri, "vless://"):
		return ParseVLESS(uri)
	case strings.HasPrefix(uri, "vmess://"):
		return ParseVMess(uri)
	case strings.HasPrefix(uri, "ss://"):
		return ParseShadowsocks(uri)
	case strings.HasPrefix(uri, "trojan://"):
		return ParseTrojan(uri)
	case strings.HasPrefix(uri, "hysteria2://") || strings.HasPrefix(uri, "hy2://") || strings.HasPrefix(uri, "hysteria://"):
		return ParseHysteria2(uri)
	case strings.HasPrefix(uri, "tuic://"):
		return ParseTUIC(uri)
	default:
		return nil, fmt.Errorf("unsupported protocol scheme in: %s", uri)
	}
}

func isSupportedScheme(s string) bool {
	s = strings.TrimSpace(s)
	return strings.HasPrefix(s, "vless://") ||
		strings.HasPrefix(s, "vmess://") ||
		strings.HasPrefix(s, "ss://") ||
		strings.HasPrefix(s, "trojan://") ||
		strings.HasPrefix(s, "hysteria2://") ||
		strings.HasPrefix(s, "hy2://") ||
		strings.HasPrefix(s, "hysteria://") ||
		strings.HasPrefix(s, "tuic://")
}

func extractLines(text string) []string {
	var lines []string
	scanner := bufio.NewScanner(strings.NewReader(text))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func tryDecodeBase64(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\n", "")
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, " ", "")

	if pad := len(s) % 4; pad != 0 {
		s += strings.Repeat("=", 4-pad)
	}

	data, err := base64.StdEncoding.DecodeString(s)
	if err == nil && len(data) > 0 {
		return data, nil
	}

	data, err = base64.URLEncoding.DecodeString(s)
	if err == nil && len(data) > 0 {
		return data, nil
	}

	return nil, fmt.Errorf("not valid base64")
}

func fetchSubscription(ctx context.Context, subURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, subURL, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", "v2rayN/6.39 TurboProbe/1.0 ClashMeta")

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("subscription HTTP status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}
