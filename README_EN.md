# TurboProbe

Aggregator and subscription generator for free VPNs (VLESS Reality, VMess, Trojan, Shadowsocks, Hysteria 2) and Telegram proxies (MTProto Fake-TLS, SOCKS5).

[Web Interface](https://sh20fk.github.io/TurboProbe/) · [TGProxy Hub](https://sh20fk.github.io/TurboProbe/#tg) · [Русский](README.md)

---

## Quick Start: VPN Subscriptions

Copy the desired subscription URL and import it into your client (Happ, FlClash, Hiddify, v2rayNG, v2rayN, Clash Verge):

| Profile | Protocols | Subscription URL |
| :--- | :--- | :--- |
| All active nodes (Full) | VLESS, VMess, Trojan, SS, Hy2 | `https://sub.turboprobe.workers.dev/sub` |
| AI Services (ChatGPT, Claude, Gemini) | VLESS Reality, VMess, Trojan | `https://sub.turboprobe.workers.dev/sub/ai` |
| YouTube 4K & Discord | VLESS Reality, Hysteria 2, Trojan | `https://sub.turboprobe.workers.dev/sub/youtube` |
| Reality & Anti-DPI | VLESS Reality | `https://sub.turboprobe.workers.dev/sub/anti-tspu` |
| Clash Meta / FlClash (YAML) | Clash Meta Config | `https://sub.turboprobe.workers.dev/sub/clash` |
| Backup Mirror (Top-50) | Base64 / Plain | `https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt` |

---

## Telegram Proxies (MTProto & SOCKS5)

Telegram proxies verified via live TLS 1.3 / Fake-TLS handshakes and Telegram DC connectivity tests.

Web Hub with 1-click connect and QR codes: [sh20fk.github.io/TurboProbe/#tg](https://sh20fk.github.io/TurboProbe/#tg)

| List | Description | Link |
| :--- | :--- | :--- |
| MTProto Fake-TLS | Direct `tg://proxy` links | [`sub/tg/mtproto.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt) |
| SOCKS5 | IP:Port list for manual setup | [`sub/tg/socks5.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/socks5.txt) |
| Low Latency Top | Fastest nodes in current pool | [`sub/tg/top20.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/top20.txt) |
| JSON API | Complete dataset with GeoIP & ISP | [`docs/tg/proxies.json`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/tg/proxies.json) |

---

## Recommended Clients

- **Windows:** [FlClash](https://github.com/chen08209/FlClash), [Happ](https://happ.im/), [Hiddify](https://github.com/hiddify/hiddify-next), [v2rayN](https://github.com/2dust/v2rayN), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)
- **Android:** [Happ](https://happ.im/), [FlClash](https://github.com/chen08209/FlClash), [v2rayNG](https://github.com/2dust/v2rayNG), [NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid), [Hiddify](https://github.com/hiddify/hiddify-next)
- **iOS / macOS:** [Happ](https://happ.im/), [Streisand](https://apps.apple.com/app/streisand/id6450534064), [Shadowrocket](https://apps.apple.com/app/shadowrocket/id932747118), [Sing-box](https://github.com/SagerNet/sing-box)
- **Linux:** [FlClash](https://github.com/chen08209/FlClash), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev), [Nekoray](https://github.com/MatsuriDayo/nekoray)

---

## How It Works

1. **Source Collection:** Crawlers aggregate configurations from public repositories and Telegram feeds.
2. **Filtering & Verification:**
   - VPN nodes are benchmarked for connectivity and latency via Xray / Mihomo.
   - MTProto & SOCKS5 proxies are verified using live TLS 1.3 handshakes and Telegram DC test probes.
3. **GeoIP:** Accurate country and ISP resolution for each node.
4. **Delivery:** Cloudflare Worker converts and serves subscriptions in Base64, Clash Meta YAML, and Sing-box JSON formats.

---

## Disclaimer

This repository is maintained solely for educational and network diagnostics purposes. All configurations are gathered from public open-source channels.

---

## Contact

Telegram: [@SH20FK](https://t.me/SH20FK)
