<p align="center">
  <b><font size="6">⚡ TurboProbe Web & Subscriptions Hub</font></b><br>
  <i>Суверенный Web-Чекер, конструктор подписок и высокоскоростной агрегатор 24/7</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/GitHub%20Pages-Live%20Hub-brightgreen?style=flat-square&logo=github" />
  <img src="https://img.shields.io/badge/Cloudflare-Worker%20v6.0-orange?style=flat-square&logo=cloudflare" />
  <img src="https://img.shields.io/badge/Проверено%20живых-12%20000%2B-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Анти--Белые%20списки-1%20900%2B-success?style=flat-square" />
  <img src="https://img.shields.io/badge/Лицензия-MIT-lightgrey?style=flat-square" />
</p>

---

### 🌐 Официальный Web-Хаб (Доступен в РФ без VPN):
👉 **[https://sh20fk.github.io/TurboProbe/](https://sh20fk.github.io/TurboProbe/)**

* ⚡ **Живой Web-Чекер в браузере**: параллельный тест 100+ нод за 2 секунды с замером пинга.
* 🛠️ **Индивидуальный Конструктор Сабок**: фильтрация по странам (🇰🇿 KZ, 🇩🇪 DE, 🇳🇱 NL, 🇫🇮 FI, 🇷🇺 RU) и протоколам (Reality, Trojan, Hy2).
* 📱 **Мгновенный QR-импорт**: наведите камеру в Happ, v2rayNG, Hiddify или Streisand для мгновенного подключения.

---

## 📡 24/7 Авто-подписки (Сортировка по минимальному пингу)

Парсер каждые 6 часов собирает ключи из 115+ источников, **проверяет каждый сокетом на доступность** (отсекая все мёртвые серверы) и публикует сабки, отсортированные **от самых быстрых к медленным**:

| Сабка | Ссылка | Описание |
| :--- | :--- | :--- |
| ⚡ **ТОП-20 Сверхнизкий пинг** | [`sub/top20.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/top20.txt) | **20 абсолютных лидеров по скорости (10–35 ms)** |
| 🛡️ **Анти-Белые списки РФ** | [`sub/anti-whitelist.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/anti-whitelist.txt) | **Работающие ключи на доменах `.ru`, Госуслуг, Сбера и VK для обхода ТСПУ** |
| ⚡ **VLESS Reality** | [`sub/reality.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/reality.txt) | Неблокируемые Reality-ноды |
| 🌐 **Все протоколы** | [`sub/all.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/all.txt) | Полный глобальный пул 100% живых проверенных нод |
| 🤖 **AI Clean IP** | [`sub/clean-ip.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/clean-ip.txt) | Чистые жилые IP без Cloudflare капч для ChatGPT и Claude |
| 🎬 **YouTube & Discord 4K** | [`sub/youtube-discord.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/youtube-discord.txt) | Максимальная пропускная способность для 4K 60FPS стриминга |
| 🚀 **Hysteria 2 / TUIC** | [`sub/hysteria2.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/hysteria2.txt) | Скоростные UDP-протоколы |
| 🔒 **Trojan TLS** | [`sub/trojan.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/trojan.txt) | Зашифрованные Trojan ноды |
| 🗝️ **Shadowsocks** | [`sub/shadowsocks.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/shadowsocks.txt) | Классический Shadowsocks |
| ⚡ **Clash Meta** | [`sub/clash-meta.yaml`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/clash-meta.yaml) | Готовый конфиг для Mihomo / Clash Verge (Auto-select) |
| 📦 **Base64** | [`sub/base64.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/base64.txt) | Универсальный Base64 формат подписки |

### 🌍 Выборки по странам:
* 🇰🇿 **Казахстан**: [`sub/kz.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/kz.txt)
* 🇩🇪 **Германия**: [`sub/de.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/de.txt)
* 🇳🇱 **Нидерланды**: [`sub/nl.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/nl.txt)
* 🇫🇮 **Финляндия**: [`sub/fi.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/fi.txt)
* 🇹🇷 **Турция**: [`sub/tr.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/tr.txt)
* 🇷🇺 **Россия (.RU)**: [`sub/ru.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/ru.txt)
* 🇺🇸 **США**: [`sub/us.txt`](https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/us.txt)

---

## ⚡ Cloudflare Worker Serverless API (`worker/`)

В репозиторий встроен готовый бесплатный **Edge-сервер на Cloudflare Workers** для динамической раздачи подписок с 0ms задержкой:
* **Авто-конвертация формата (User-Agent Sniffing)**:
  * Запрос от **Clash / Mihomo** ➔ автоматически отдаёт чистый `Clash Meta YAML`.
  * Запрос от **Happ / v2rayNG / Hiddify** ➔ отдаёт оптимизированный список сабок.
  * Запрос из **Браузера** ➔ открывает веб-дашборд с генератором QR-кодов.

```bash
# Развернуть свой бесплатный Edge Worker:
cd worker
npx wrangler deploy
```

---

## 📁 Структура проекта

```
TurboProbe/
├── docs/                 # Standalone Web Hub для GitHub Pages (доступен в РФ без VPN)
│   └── index.html
├── tools/                # Сверхбыстрый парсер & сокет-чекер v5.0 (250 потоков)
│   └── aggregator.py
├── sub/                  # Все автоматически генерируемые сабки (отсортированы по пингу)
│   ├── top20.txt
│   ├── anti-whitelist.txt
│   ├── reality.txt
│   └── ...
├── worker/               # Cloudflare Worker v6.0 Anycast Edge Hub
│   └── index.js
└── deprecated/           # Архив старых нативных клиентов Flutter/Go (app & core)
```

---

## 📄 Лицензия
Распространяется под лицензией **MIT**.
