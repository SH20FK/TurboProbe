package geoip

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type GeoInfo struct {
	CountryCode string `json:"country_code"`
	CountryName string `json:"country_name"`
	City        string `json:"city"`
	FlagEmoji   string `json:"flag_emoji"`
	ISP         string `json:"isp"`
	QueryIP     string `json:"query_ip"`
}

type Resolver struct {
	cache sync.Map // map[string]*GeoInfo
	mu    sync.Mutex
}

func NewResolver() *Resolver {
	return &Resolver{}
}

// Resolve retrieves GeoIP information for a host (domain or IP address)
func (r *Resolver) Resolve(ctx context.Context, host string) (*GeoInfo, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		return nil, fmt.Errorf("empty host")
	}

	// Remove port if present
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		h, _, err := net.SplitHostPort(host)
		if err == nil {
			host = h
		}
	}

	// Check cache
	if cached, ok := r.cache.Load(host); ok {
		return cached.(*GeoInfo), nil
	}

	// Resolve to IP if host is a domain
	ipStr := host
	if net.ParseIP(host) == nil {
		ips, err := net.LookupIP(host)
		if err == nil && len(ips) > 0 {
			ipStr = ips[0].String()
		}
	}

	info, err := r.fetchGeoInfo(ctx, ipStr)
	if err != nil {
		// Fallback to unknown
		info = &GeoInfo{
			CountryCode: "UN",
			CountryName: "Unknown",
			FlagEmoji:   "🌐",
			ISP:         "Unknown ISP",
			QueryIP:     ipStr,
		}
	}

	r.cache.Store(host, info)
	return info, nil
}

type ipWhoIsResp struct {
	Success     bool   `json:"success"`
	CountryCode string `json:"country_code"`
	Country     string `json:"country"`
	City        string `json:"city"`
	Connection  struct {
		ISP string `json:"isp"`
		Org string `json:"org"`
	} `json:"connection"`
}

func (r *Resolver) fetchGeoInfo(ctx context.Context, ip string) (*GeoInfo, error) {
	url := fmt.Sprintf("https://ipwho.is/%s", ip)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data ipWhoIsResp
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	if !data.Success && data.CountryCode == "" {
		return nil, fmt.Errorf("ip lookup failed")
	}

	cc := strings.ToUpper(data.CountryCode)
	if cc == "" {
		cc = "UN"
	}

	isp := data.Connection.ISP
	if isp == "" {
		isp = data.Connection.Org
	}
	if isp == "" {
		isp = "Unknown"
	}

	return &GeoInfo{
		CountryCode: cc,
		CountryName: data.Country,
		City:        data.City,
		FlagEmoji:   CountryCodeToEmoji(cc),
		ISP:         isp,
		QueryIP:     ip,
	}, nil
}

// CountryCodeToEmoji converts a 2-letter ISO country code to its flag emoji
func CountryCodeToEmoji(countryCode string) string {
	countryCode = strings.ToUpper(strings.TrimSpace(countryCode))
	if len(countryCode) != 2 {
		return "🌐"
	}
	// Regional indicator symbols start at 0x1F1E6 for 'A'
	r1 := rune(countryCode[0]) - 'A' + 0x1F1E6
	r2 := rune(countryCode[1]) - 'A' + 0x1F1E6
	if r1 < 0x1F1E6 || r1 > 0x1F1FF || r2 < 0x1F1E6 || r2 > 0x1F1FF {
		return "🌐"
	}
	return string([]rune{r1, r2})
}
