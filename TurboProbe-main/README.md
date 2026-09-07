# TurboProbe

Агрегатор и генератор бесплатных VPN-подписок (VLESS Reality, VMess, Trojan, Shadowsocks, Hysteria 2) и Telegram-прокси (MTProto Fake-TLS, SOCKS5).

[Веб-интерфейс](https://sh20fk.github.io/TurboProbe/) · [TGProxy Hub](https://sh20fk.github.io/TurboProbe/#tg) · [English](README_EN.md)

---

## Быстрый старт: VPN-подписки

Скопируйте ссылку нужного профиля и вставьте в клиент (Happ, FlClash, Hiddify, v2rayNG, v2rayN, Clash Verge):

| Профиль | Протоколы | Ссылка на подписку |
| :--- | :--- | :--- |
| Все рабочие узлы (Full) | VLESS, VMess, Trojan, SS, Hy2 | `https://sub.turboprobe.workers.dev/sub` |
| AI-сервисы (ChatGPT, Claude, Gemini) | VLESS Reality, VMess, Trojan | `https://sub.turboprobe.workers.dev/sub/ai` |
| YouTube 4K & Discord | VLESS Reality, Hysteria 2, Trojan | `https://sub.turboprobe.workers.dev/sub/youtube` |
| Reality & Anti-DPI | VLESS Reality | `https://sub.turboprobe.workers.dev/sub/anti-tspu` |
| Clash Meta / FlClash (YAML) | Clash Meta Config | `https://sub.turboprobe.workers.dev/sub/clash` |
| Резервное зеркало (Top-50) | Base64 / Plain | `https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt` |

---

## Telegram-прокси (MTProto & SOCKS5)

Прокси для Telegram с предварительной проверкой доступности и TLS 1.3 / Fake-TLS рукопожатий.

Веб-страница с подключением в 1 клик и QR-кодами: [sh20fk.github.io/TurboProbe/#tg](https://sh20fk.github.io/TurboProbe/#tg)

| Список | Описание | Ссылка |
| :--- | :--- | :--- |
| MTProto Fake-TLS | Прямые ссылки `tg://proxy` | [`sub/tg/mtproto.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/mtproto.txt) |
| SOCKS5 | Список IP:Port для добавления в клиент | [`sub/tg/socks5.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/socks5.txt) |
| Топ с низким пингом | Быстрые серверы из текущего пула | [`sub/tg/top20.txt`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/tg/top20.txt) |
| JSON API | Полные данные с геолокацией и ISP | [`docs/tg/proxies.json`](https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/tg/proxies.json) |

---

## Рекомендуемые клиенты

- **Windows:** [FlClash](https://github.com/chen08209/FlClash), [Happ](https://happ.im/), [Hiddify](https://github.com/hiddify/hiddify-next), [v2rayN](https://github.com/2dust/v2rayN), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)
- **Android:** [Happ](https://happ.im/), [FlClash](https://github.com/chen08209/FlClash), [v2rayNG](https://github.com/2dust/v2rayNG), [NekoBox](https://github.com/MatsuriDayo/NekoBoxForAndroid), [Hiddify](https://github.com/hiddify/hiddify-next)
- **iOS / macOS:** [Happ](https://happ.im/), [Streisand](https://apps.apple.com/app/streisand/id6450534064), [Shadowrocket](https://apps.apple.com/app/shadowrocket/id932747118), [Sing-box](https://github.com/SagerNet/sing-box)
- **Linux:** [FlClash](https://github.com/chen08209/FlClash), [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev), [Nekoray](https://github.com/MatsuriDayo/nekoray)

---

## Принцип работы

1. **Сбор источников:** скрипты опрашивают открытые репозитории и публичные Telegram-каналы.
2. **Фильтрация и проверка:**
   - VPN-конфигурации проверяются на сетевую доступность и задержку через Xray / Mihomo.
   - MTProto и SOCKS5 прокси тестируются реальным TLS 1.3 рукопожатием и тестовым запросом к дата-центрам Telegram.
3. **GeoIP:** определение страны и провайдера каждого узла.
4. **Раздача:** Cloudflare Worker на лету отдает подписки в форматах Base64, Clash Meta YAML и Sing-box JSON.

---

## Дисклеймер

Проект разработан исключительно в образовательных целях и для сетевой диагностики. Все данные собраны из открытых источников.

---

## Контакты

Telegram: [@SH20FK](https://t.me/SH20FK)
