<div align="center">
  <img src="https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/logo.svg" width="80" height="80" alt="TurboProbe Logo" />
  <h1>TurboProbe</h1>
  <p><b>Автономный реестр VPN-подписок и живых Telegram MTProto / SOCKS5 прокси</b></p>

  <p>
    <a href="https://sh20fk.github.io/TurboProbe/"><img src="https://img.shields.io/badge/Веб--интерфейс-TurboProbe_Hub-2481CC?style=flat-square&logo=telegram&logoColor=white" alt="Web Interface" /></a>
    <a href="https://sh20fk.github.io/TurboProbe/#tg"><img src="https://img.shields.io/badge/TGProxy-MTProto_Hub-0088cc?style=flat-square" alt="TGProxy Hub" /></a>
    <a href="README_EN.md"><img src="https://img.shields.io/badge/Language-English-blue?style=flat-square" alt="English README" /></a>
  </p>
</div>

---

### 🌐 Навигация по разделам

- [⚡ Быстрый старт: VPN Подписки](#-быстрый-старт-vpn-подписки)
- [🛡️ Telegram Прокси (MTProto & SOCKS5)](#️-telegram-прокси-mtproto--socks5)
- [📱 Поддерживаемые клиенты](#-поддерживаемые-клиенты)
- [⚙️ Как устроен проект](#️-как-устроен-проект)
- [💬 Связь и поддержка](#-связь-и-поддержка)

---

## ⚡ Быстрый старт: VPN Подписки

Вставьте нужную ссылку в ваш клиент (**Happ**, **FlClash**, **Hiddify**, **v2rayNG**, **v2rayN**, **Clash Verge Rev**):

| Назначение | Протоколы | Ссылка на подписку |
| :--- | :--- | :--- |
| 🚀 **Все проверенные узлы (Top Live)** | VLESS, VMess, Trojan, SS, Hy2 | `https://sub.turboprobe.workers.dev/sub` |
| 🧠 **AI & Нейросети (ChatGPT, Claude)** | VLESS Reality, VMess, Trojan | `https://sub.turboprobe.workers.dev/sub/ai` |
| 📺 **YouTube 4K & Discord (High Speed)** | VLESS Reality, Hysteria2, Trojan | `https://sub.turboprobe.workers.dev/sub/youtube` |
| 🛡️ **Анти-ТСПУ (VLESS Reality & SNI Bypass)** | VLESS Reality | `https://sub.turboprobe.workers.dev/sub/anti-tspu` |
| ⚔️ **Clash Meta / FlClash (YAML Auto-Best)** | Clash Meta Config | `https://sub.turboprobe.workers.dev/sub/clash` |
| 📦 **Резервное зеркало (GitHub Raw Top-50)** | Base64 / Plain | `https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt` |

---

## 🛡️ Telegram Прокси (MTProto & SOCKS5)

Готовые списки проверенных прокси для Telegram с автоматическим сквозным тестированием рукопожатий Fake-TLS (TLS 1.3) и туннелей до дата-центров Telegram DC2 (`149.154.167.50:443`).

👉 **Веб-версия с подключением в 1 клик и QR-кодами:** [sh20fk.github.io/TurboProbe/#tg](https://sh20fk.github.io/TurboProbe/#tg)

| Формат / Список | Описание | Ссылка |
| :--- | :--- | :--- |
| 🔒 **MTProto Fake-TLS (Все узлы)** | Прямые ссылки `tg://proxy` для быстрого импорта | [`sub/tg/mtproto.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt) |
| 🧦 **SOCKS5 Прокси** | Список IP:Port для добавления в настройки Telegram | [`sub/tg/socks5.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/socks5.txt) |
| ⚡ **Топ-20 с минимальным пингом** | Самые быстрые серверы на текущий момент | [`sub/tg/top20.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/top20.txt) |
| 🌐 **JSON API** | Полный дамп с метаданными, странами, городами и ISP | [`docs/tg/proxies.json`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/tg/proxies.json) |

---

## 📱 Поддерживаемые клиенты

| Платформа | Рекомендуемые приложения |
| :--- | :--- |
| 🪟 **Windows** | [FlClash](https://github.com/chen08209/FlClash), [Happ](https://happ.im/), [Hiddify](https://github.com/hiddify/hiddify-next), [v2rayN](https://github.com/2dust/v2rayN), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev) |
| 🤖 **Android** | [Happ](https://happ.im/), [FlClash](https://github.com/chen08209/FlClash), [v2rayNG](https://github.com/2dust/v2rayNG), [NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid), [Hiddify](https://github.com/hiddify/hiddify-next) |
| 🍏 **iOS / macOS** | [Happ Proxy Utility](https://happ.im/), [Streisand](https://apps.apple.com/app/streisand/id6450534064), [Shadowrocket](https://apps.apple.com/app/shadowrocket/id932747118), [Sing-box](https://github.com/SagerNet/sing-box) |
| 🐧 **Linux** | [FlClash](https://github.com/chen08209/FlClash), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev), [Nekoray](https://github.com/MatsuriDayo/nekoray) |

---

## ⚙️ Как устроен проект

1. **Multi-Forge Discovery Engine**: бот-сыщик непрерывно сканирует 300+ источников (GitHub, GitLab, GitVerse, Codeberg, Telegram-каналы) на наличие свежих конфигураций.
2. **Сквозная валидация без ложных срабатываний**:
   - VPN-узлы проверяются реальным Xray/Mihomo ядром.
   - MTProto прокси тестируются через подлинное TLS 1.3 рукопожатие с расшифровкой домена SNI.
   - SOCKS5 прокси проверяются прямым запросом `SOCKS5 CONNECT` до дата-центров Telegram.
3. **GeoIP обогащение**: определение точной страны, города и хостинг-провайдера каждого узла с приоритетным выводом российских серверов для обхода белых списков и ограничений.
4. **Cloudflare Edge Worker**: моментальная отдача подписок в форматах Base64, SIP002, Clash Meta YAML и Sing-box JSON.

---

## 📄 Отказ от ответственности

Проект создан исключительно в исследовательских и образовательных целях для анализа доступности сетевых протоколов и тестирования устойчивости туннелирования. Все данные агрегируются из открытых общедоступных источников.

---

## 💬 Связь и поддержка

Если у вас возникли вопросы, предложения или пожелания — пишите в Telegram: **[@SH20FK](https://t.me/SH20FK)**.
