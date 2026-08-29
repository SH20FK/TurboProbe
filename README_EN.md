<div align="center">
  <img src="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/logo.svg" width="80" height="80" alt="TurboProbe Logo" />
  <h1>TurboProbe</h1>
  <p><b>Autonomous VPN Subscription Registry & Verified Telegram MTProto / SOCKS5 Proxies</b></p>

  <p>
    <a href="https://sh20fk.github.io/TurboProbe/"><img src="https://img.shields.io/badge/Web_Interface-TurboProbe_Hub-2481CC?style=flat-square&logo=telegram&logoColor=white" alt="Web Interface" /></a>
    <a href="https://sh20fk.github.io/TurboProbe/#tg"><img src="https://img.shields.io/badge/TGProxy-MTProto_Hub-0088cc?style=flat-square" alt="TGProxy Hub" /></a>
    <a href="README.md"><img src="https://img.shields.io/badge/Language-Русский-red?style=flat-square" alt="Russian README" /></a>
  </p>
</div>

---

### 🌐 Table of Contents

- [⚡ Quick Start: VPN Subscriptions](#-quick-start-vpn-subscriptions)
- [🛡️ Telegram Proxies (MTProto & SOCKS5)](#️-telegram-proxies-mtproto--socks5)
- [📱 Supported Clients](#-supported-clients)
- [⚙️ Architecture & Features](#️-architecture--features)
- [💬 Contact & Feedback](#-contact--feedback)

---

## ⚡ Quick Start: VPN Subscriptions

Import any of these links into your favorite client (**Happ**, **FlClash**, **Hiddify**, **v2rayNG**, **v2rayN**, **Clash Verge Rev**):

| Preset / Goal | Protocols | Subscription URL |
| :--- | :--- | :--- |
| 🚀 **All Verified Nodes (Top Live)** | VLESS, VMess, Trojan, SS, Hy2 | `https://sub.turboprobe.workers.dev/sub` |
| 🧠 **AI & LLMs (ChatGPT, Claude)** | VLESS Reality, VMess, Trojan | `https://sub.turboprobe.workers.dev/sub/ai` |
| 📺 **YouTube 4K & Discord (High Speed)** | VLESS Reality, Hysteria2, Trojan | `https://sub.turboprobe.workers.dev/sub/youtube` |
| 🛡️ **Anti-Censorship & DPI Bypass** | VLESS Reality | `https://sub.turboprobe.workers.dev/sub/anti-tspu` |
| ⚔️ **Clash Meta / FlClash (YAML Auto-Best)** | Clash Meta Config | `https://sub.turboprobe.workers.dev/sub/clash` |
| 📦 **Fallback Mirror (GitHub Raw Top-50)** | Base64 / Plain | `https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt` |

---

## 🛡️ Telegram Proxies (MTProto & SOCKS5)

Verified Telegram proxies strictly tested via genuine Fake-TLS (TLS 1.3) handshakes and direct `SOCKS5 CONNECT` tunnels to Telegram DC2 (`149.154.167.50:443`).

👉 **Web Hub with 1-Click Connect & QR Codes:** [sh20fk.github.io/TurboProbe/#tg](https://sh20fk.github.io/TurboProbe/#tg)

| Format / Preset | Description | Link |
| :--- | :--- | :--- |
| 🔒 **MTProto Fake-TLS (All Nodes)** | Direct `tg://proxy` links for quick import | [`sub/tg/mtproto.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt) |
| 🧦 **SOCKS5 Proxies** | Raw IP:Port list for Telegram network settings | [`sub/tg/socks5.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/socks5.txt) |
| ⚡ **Top 20 Lowest Latency** | Fastest verified nodes at this moment | [`sub/tg/top20.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/top20.txt) |
| 🌐 **JSON API** | Complete dump with countries, cities, and ISP metadata | [`docs/tg/proxies.json`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/tg/proxies.json) |

---

## 📱 Supported Clients

| OS | Recommended Applications |
| :--- | :--- |
| 🪟 **Windows** | [FlClash](https://github.com/chen08209/FlClash), [Happ](https://happ.im/), [Hiddify](https://github.com/hiddify/hiddify-next), [v2rayN](https://github.com/2dust/v2rayN), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) |
| 🤖 **Android** | [Happ](https://happ.im/), [FlClash](https://github.com/chen08209/FlClash), [v2rayNG](https://github.com/2dust/v2rayNG), [NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid), [Hiddify](https://github.com/hiddify/hiddify-next) |
| 🍏 **iOS / macOS** | [Happ Proxy Utility](https://happ.im/), [Streisand](https://apps.apple.com/app/streisand/id6450534064), [Shadowrocket](https://apps.apple.com/app/shadowrocket/id932747118), [Sing-box](https://github.com/SagerNet/sing-box) |
| 🐧 **Linux** | [FlClash](https://github.com/chen08209/FlClash), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev), [Nekoray](https://github.com/MatsuriDayo/nekoray) |

---

## ⚙️ Architecture & Features

1. **Multi-Forge Discovery Engine**: Sleuth crawler continuously scans 300+ feeds across GitHub, GitLab, GitVerse, Codeberg, and Telegram channels.
2. **Strict Verification Without False Positives**:
   - VPN nodes are benchmarked using real Xray & Mihomo cores.
   - MTProto proxies are verified via genuine TLS 1.3 handshakes with decoded SNI domain matching.
   - SOCKS5 proxies are tested with end-to-end `SOCKS5 CONNECT` commands to Telegram Data Centers.
3. **High-Precision GeoIP Enrichment**: Automatic resolution of exact country, city, and ISP for every verified node.
4. **Cloudflare Edge Worker**: Dynamic high-speed conversion and distribution across Base64, SIP002, Clash Meta YAML, and Sing-box JSON.

---

## 📄 Disclaimer

This repository is maintained for educational and network diagnostics purposes to evaluate the availability of communication protocols and test tunneling resilience. All configurations are aggregated from public open-source channels.

---

## 💬 Contact & Feedback

If you have questions, suggestions, or issues, reach out on Telegram: **[@SH20FK](https://t.me/SH20FK)**.
