# ⚡ TurboProbe VPN Filter & Auto-Aggregator

<p align="center">
  <img src="app/assets/icon.png" width="128" height="128" alt="TurboProbe VPN Logo" />
</p>

<p align="center">
  <b>Ультимативный кроссплатформенный бенчмарк, фильтр и 24/7 авто-агрегатор VPN-ключей для Android, Windows и Linux.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/Engine-True%20Tunnel%20Probe-indigo?style=flat-square" alt="Engine" />
  <img src="https://img.shields.io/badge/UI-Google%20B%26W%20Ascetic-teal?style=flat-square" alt="UI" />
  <img src="https://img.shields.io/badge/Accuracy-100%25%20Happ%20Compatible-success?style=flat-square" alt="Accuracy" />
  <img src="https://img.shields.io/badge/Aggregator-10000%2B%20Nodes-orange?style=flat-square" alt="Aggregator" />
</p>

---

## 📡 24/7 Автоматические супер-подписки (Auto-Aggregator)

Бот каждые 6 часов сканирует 80+ проверенных репозиториев и каналов, дедуплицирует ключи и собирает единые ссылки:

| Категория | Ссылка на подписку (Raw URL) | Описание |
| :--- | :--- | :--- |
| 🛡️ **Anti-Whitelist** | `https://raw.githubusercontent.com/SH20FK/EGS/main/sub/anti-whitelist.txt` | **Ключи против белых списков и глушения ТСПУ** |
| ⚡ **VLESS Reality** | `https://raw.githubusercontent.com/SH20FK/EGS/main/sub/reality.txt` | 100% неблокируемый VLESS Reality для РФ |
| 🌐 **Все ключи (9500+)** | `https://raw.githubusercontent.com/SH20FK/EGS/main/sub/all.txt` | Полный объединённый пул всех протоколов |
| 🚀 **Hysteria 2 / TUIC** | `https://raw.githubusercontent.com/SH20FK/EGS/main/sub/hysteria2.txt` | Сверхскоростные UDP-протоколы |
| 🔒 **Trojan** | `https://raw.githubusercontent.com/SH20FK/EGS/main/sub/trojan.txt` | Зашифрованные Trojan TLS ноды |
| 📦 **Base64** | `https://raw.githubusercontent.com/SH20FK/EGS/main/sub/base64.txt` | Универсальная Base64 подписка |

---

## ⚡ Как пользоваться приложением

1. **Вставьте ссылки** на подписки (или нажмите быстрый пресет в приложении) или список ключей в текстовое поле.
2. Нажмите **«Запустить тест»** — за несколько секунд фоновый движок проверит сотни нод сквозными туннелями.
3. Нажмите **«В Happ»**, **«В Incy»** или **«Экспорт»** и скопируйте ТОП лучших рабочих ключей!

---

## 🌟 5 Авторских механизмов проверки TurboProbe

- 🎯 **Composite Reality Latency (CRL)**:
  - Трёхкомпонентный расчёт пинга ($T_{\text{handshake}} + T_{\text{TTFB}} + T_{\text{jitter}}$).
  - Показывает реальную задержку в онлайн-играх и при старте видео (`54 ms ±3 ms`).
- 🛡️ **DPI Pulse-Wave (Детектор глушения ТСПУ)**:
  - Отправка микро-волны пакетов для выявления скрытого сброса соединений (`TCP RST` / Packet Drop).
  - Автоматически помечает ноды: `🛡️ Анти-ТСПУ (DPI Pass)` или `⚠️ Глушится ТСПУ (DPI Drop)`.
- 🎬 **StreamBand 4K Gauge (Микро-замер скорости)**:
  - Оценка пропускной способности за 150 мс без расхода трафика: `4K HDR`, `1080p 60fps`, `720p HD`.
- 🧬 **Egress Cleanliness & Captcha Index**:
  - Проверка репутации выходного IP: `✨ Чистый IP (Без капчи)` vs `⚠️ Cloudflare Captcha Risk`.
- 🤖 **Smart Dedup & Host Fingerprinting**:
  - Авто-детект серверов-клонов по реальному Egress IP и SNI. Фильтр **«Без клонов»** в 1 клик оставляет только уникальные физические серверы.

---

## 📥 Скачать готовые сборки

Готовые файлы доступны во вкладке **[GitHub Releases](../../releases)**:

| Платформа | Формат файла | Описание |
| :--- | :--- | :--- |
| 📱 **Android** | `app-release.apk` | Готовый APK для смартфонов и планшетов |
| 🪟 **Windows** | `turboprobe-windows-x64.zip` | Портативная версия для Windows 10/11 x64 |
| 🐧 **Linux** | `turboprobe-linux-x64.tar.gz` | Сборка для Linux (Ubuntu, Debian, Fedora, Arch) |

---

<p align="center">
  Разработано для максимальной скорости, точности и комфорта в RU-регионе ⚡
</p>
