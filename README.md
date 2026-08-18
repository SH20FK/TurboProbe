# ⚡ TurboProbe VPN Filter

> **Кроссплатформенная утилита и приложение (Windows, Linux, Android) для мгновенного локального тестирования, бенчмаркинга и фильтрации VPN-ключей и подписок.**

Проверяет работоспособность и реальный пинг сотен и тысяч VPN-ключей прямо на вашем устройстве (с учетом блокировок вашего конкретного провайдера и ТСПУ/DPI), отсеивает мертвые ноды и выдает чистый список лучших рабочих ключей с минимальным пингом.

---

## ✨ Ключевые возможности

- 🚀 **Алгоритм «Turbo-Probe Pipeline»**:
  1. **Мгновенная дедупликация и валидация** ключей и Base64-подписок.
  2. **Protocol-Handshake Check**: Асинхронная проверка TCP/TLS/SNI/Reality на 50–200 потоках без запуска тяжелых TUN-интерфейсов (1000 ключей за 5–10 секунд).
  3. **Micro-Burst Stability Check**: Пакетный микро-тест из 3 запросов для выявления скрытых глушилок и джиттера провайдера.
  4. **True RTT / TTFB Latency**: Замер реального времени ответа до целевого сервера (Cloudflare 204, Google 204, YouTube, Telegram или ваш кастомный URL).
- 🌐 **Поддерживаемые протоколы**:
  - `VLESS` (Reality, XTLS-Vision, TLS, gRPC, WebSocket, TCP)
  - `Hysteria 2` / `Hy2` (QUIC)
  - `TUIC v5` (QUIC)
  - `Shadowsocks` (SS-2022, AEAD)
  - `Trojan` (TLS, gRPC, WebSocket)
  - `VMess` (TLS, WebSocket, TCP)
- 🌍 **Авто-определение GeoIP & Флагов**: Страна, город, флаг эмодзи и имя провайдера/ASN для каждого узла.
- 📦 **Гибкий экспорт в 1 клик**:
  - Копирование ТОП-5, ТОП-10 или всех рабочих ключей в буфер обмена.
  - Экспорт в Raw ссылки (`vless://`, etc.).
  - Экспорт в Base64 подписку.
  - Экспорт в конфигурацию **Clash Meta (Mihomo) YAML**.
  - Экспорт в конфигурацию **sing-box JSON**.
- 🎨 **Современный кроссплатформенный UI (Flutter)**:
  - Тёмная неоновая тема.
  - Живой прогресс-бар и статистика (Total, Alive, Dead, Avg Ping).
  - Поиск, сортировка и фильтрация по странам, протоколам и задержке.

---

## 📁 Структура репозитория

```
├── .github/workflows/
│   └── build.yml               # GitHub Actions: автоматическая сборка Windows (.exe), Linux (.tar.gz), Android (.apk)
├── core/                       # Go Core Engine
│   ├── go.mod
│   ├── main.go                 # CLI и Server режимы запуска ядра
│   └── pkg/
│       ├── parser/             # Парсеры VLESS, VMess, SS, Trojan, Hy2, TUIC, Base64
│       ├── probe/              # Turbo-Probe: Handshake, Micro-burst, HTTP RTT, Engine
│       ├── geoip/              # GeoIP & Flag Resolver
│       ├── exporter/           # Генераторы Clash YAML, sing-box JSON, Raw URI, Base64
│       └── server/             # Локальный REST API + WebSocket Hub
└── app/                        # Flutter Cross-Platform UI
    ├── pubspec.yaml
    └── lib/
        ├── main.dart
        ├── theme/              # Стильная темная тема
        ├── models/             # Модели нод и настроек
        ├── services/           # REST & WebSocket API клиент
        ├── providers/          # Управление состоянием (ProbeProvider)
        ├── widgets/            # Карточки нод, статистика, фильтры, прогресс
        └── screens/            # Главный экран, настройки, окно экспорта
```

---

## 🛠 Автоматическая сборка в GitHub Actions

При каждом `push` в ветку `main` или создании релизного тега `v*` GitHub Actions автоматически собирает:
1. **Windows x64**: Портативный архив с Flutter UI + Go Core.
2. **Linux x64**: Архив приложения для Linux.
3. **Android**: Готовый установочный `app-release.apk`.
4. **Go Core Binaries**: Автономные консольные бинарники для Windows, Linux amd64 и arm64.

---

## 💻 Использование через консоль (CLI)

Вы можете использовать Go Core как самостоятельную консольную утилиту:

```bash
# Тестирование подписки по ссылке и вывод ТОП живых ключей в файл
go run ./core/main.go -input "https://example.com/sub" -c 100 -export working_keys.txt

# Тестирование локального файла с ключами
go run ./core/main.go -input my_keys.txt -target "http://cp.cloudflare.com/generate_204" -format clash -export clash_config.yaml
```

---

## 🚀 Запуск в режиме разработки

### Запуск Go Core
```bash
cd core
go run main.go -server -port 8999
```

### Запуск Flutter UI
```bash
cd app
flutter pub get
flutter run
```
