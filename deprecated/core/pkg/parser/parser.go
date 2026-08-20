package parser

import (
	"bufio"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ParseInput takes raw string input (single key, multiline keys, multiple subscription URLs, or Base64)
// and returns a deduplicated list of NodeConfigs.
func ParseInput(ctx context.Context, input string) ([]*NodeConfig, error) {
	input = strings.TrimSpace(input)
	if input == "" {
		return nil, fmt.Errorf("empty input provided")
	}

	rawLines := extractLines(input)
	var urlList []string
	var directLines []string

	for _, line := range rawLines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "http://") || strings.HasPrefix(line, "https://") {
			urlList = append(urlList, line)
		} else {
			directLines = append(directLines, line)
		}
	}

	var allURIs []string
	var mu sync.Mutex

	// 1. Concurrently fetch all subscription URLs if present
	if len(urlList) > 0 {
		var wg sync.WaitGroup
		for _, u := range urlList {
			wg.Add(1)
			go func(subURL string) {
				defer wg.Done()
				fetchCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
				defer cancel()

				content, err := fetchSubscription(fetchCtx, subURL)
				if err == nil && content != "" {
					extracted := parseTextBlobToURIs(content)
					mu.Lock()
					allURIs = append(allURIs, extracted...)
					mu.Unlock()
				}
			}(u)
		}
		wg.Wait()
	}

	// 2. Parse direct text lines
	if len(directLines) > 0 {
		combinedDirect := strings.Join(directLines, "\n")
		extracted := parseTextBlobToURIs(combinedDirect)
		allURIs = append(allURIs, extracted...)
	}

	// 3. Fallback: If still empty, try decoding entire raw input as one big base64 block
	if len(allURIs) == 0 {
		allURIs = parseTextBlobToURIs(input)
	}

	// 4. Parse individual URIs and deduplicate
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

	if len(nodes) == 0 {
		return nil, fmt.Errorf("no valid VPN keys or subscription links found in input")
	}

	return nodes, nil
}

func parseTextBlobToURIs(text string) []string {
	var uris []string
	lines := extractLines(text)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "#") {
			continue
		}

		if isSupportedScheme(line) {
			uris = append(uris, line)
			continue
		}

		// Try decoding as base64 block
		decoded, err := tryDecodeBase64(line)
		if err == nil && len(decoded) > 0 {
			subLines := extractLines(string(decoded))
			for _, subLine := range subLines {
				subLine = strings.TrimSpace(subLine)
				if isSupportedScheme(subLine) {
					uris = append(uris, subLine)
				}
			}
		}
	}

	// If no URIs found line by line, try entire blob base64
	if len(uris) == 0 {
		decoded, err := tryDecodeBase64(text)
		if err == nil {
			subLines := extractLines(string(decoded))
			for _, subLine := range subLines {
				subLine = strings.TrimSpace(subLine)
				if isSupportedScheme(subLine) {
					uris = append(uris, subLine)
				}
			}
		}
	}

	return uris
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
		Timeout: 12 * time.Second,
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
