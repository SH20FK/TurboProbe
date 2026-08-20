# 📋 Техническое задание: Фронтенд конструктора подписок TurboProbe

## 1. О проекте и цель сайта
**TurboProbe** — это открытый агрегатор и глубокий верификатор VPN-подписок (VLESS Reality, Trojan, Hysteria 2, Shadowsocks).

**Цель сайта:** 
Предоставить пользователю удобный интерактивный веб-конструктор: пользователь выбирает нужные сервисы (ChatGPT, YouTube 4K, Discord и т.д.), страны и лимиты, а сайт формирует персональную ссылку на подписку и позволяет импортировать её в 1 клик в **Happ**, **Clash Meta / Flclash** или скопировать для **v2rayNG / Hiddify / Streisand**.

**Архитектура:** 
* **Zero-Backend (чистый статический фронтенд)**.
* Фронтенд работает без своего сервера и БД — хостится на **GitHub Pages / Cloudflare Pages / Vercel**.
* Все данные и генерацию подписок на лету выполняет наш **Cloudflare Edge Worker API**.

---

## 2. API Бэкенда (Cloudflare Worker)

**Базовый URL API:** `https://api.turboprobe.workers.dev` *(или кастомный домен пользователя)*

### Эндпоинты:

#### 1. `GET /api/stats`
Возвращает общую статистику системы:
```json
{
  "updated_at": "2026-08-20T12:00:00Z",
  "total_sources": 120,
  "active_sources": 85,
  "unique_nodes": 71000,
  "alive_verified_nodes": 56000,
  "best_ping_ms": 14.2,
  "avg_ping_ms": 48.5
}
```

#### 2. `GET /api/countries`
Возвращает список всех активных стран мира с флагами и количеством рабочих серверов:
```json
{
  "total_countries": 28,
  "countries": [
    { "code": "DE", "flag": "🇩🇪", "count": 1420, "file": "countries/de.txt" },
    { "code": "NL", "flag": "🇳🇱", "count": 980, "file": "countries/nl.txt" },
    { "code": "KZ", "flag": "🇰🇿", "count": 430, "file": "countries/kz.txt" },
    { "code": "FI", "flag": "🇫🇮", "count": 350, "file": "countries/fi.txt" },
    { "code": "JP", "flag": "🇯🇵", "count": 210, "file": "countries/jp.txt" },
    { "code": "US", "flag": "🇺🇸", "count": 680, "file": "countries/us.txt" }
  ]
}
```

#### 3. `GET /api/nodes?[фильтры]`
Возвращает массив проверенных карточек серверов (для живого предпросмотра или поиска):
```json
{
  "total_matching": 420,
  "nodes": [
    {
      "uri": "vless://...@1.2.3.4:443?security=reality...#TurboProbe...",
      "ping_ms": 32.0,
      "country": "DE",
      "protocol": "vless-reality",
      "services": {
        "chatgpt": true,
        "claude": true,
        "gemini": false,
        "perplexity": true,
        "youtube": true,
        "discord": true,
        "instagram": true,
        "twitter": true,
        "spotify": true,
        "github": true
      }
    }
  ]
}
```

#### 4. `GET /sub?[параметры]` (Генератор подписки)
Формирует готовую подписку по выбранным параметрам.

**Поддерживаемые Query-параметры:**
* `services=` — список сервисов через запятую: `chatgpt,claude,gemini,perplexity,youtube,discord,instagram,twitter,spotify,github`
* `country=` или `c=` — коды стран через запятую: `de,nl,kz,fi,us,jp` (или `all`)
* `max_ping=` или `ping=` — максимальный допустимый пинг (число в мс, например `100`)
* `proto=` или `p=` — фильтр протокола (`reality`, `vless`, `trojan`, `hy2`, `ss`)
* `limit=` или `n=` — лимит ключей (по умолчанию `20`, макс `300`)
* `format=` или `f=` — формат выдачи:
  * `raw` (по умолчанию) — обычный список ссылок `vless://...`
  * `base64` — base64-строка для классических VPN-клиентов
  * `clash` — YAML конфиг для Clash Meta / Mihomo / Flclash

#### 5. Готовые прямые сабки (Static Presets):
* `/sub/all` — все проверенные ключи (по возрастанию пинга)
* `/sub/top20` — топ-20 быстрейших ключей
* `/sub/top50` — топ-50 быстрейших ключей
* `/sub/anti-whitelist` — для обхода ТСПУ/белых списков в РФ
* `/sub/service/chatgpt` — только чистые ключи для ChatGPT
* `/sub/service/claude` — только ключи для Claude AI
* `/sub/service/gemini` — только ключи для Google Gemini
* `/sub/service/youtube` — ключи с быстрым Google CDN для YouTube 4K
* `/sub/service/discord` — ключи для голосовых и текстовых каналов Discord
* `/sub/country/de` — только серверы Германии (работает для любого кода страны)

---

## 3. Функциональные блоки сайта

```
+-------------------------------------------------------------+
|  ⚡ TurboProbe  |  🟢 56,400 серверов  |  ⏱️ Ср. пинг: 48ms  |
+-------------------------------------------------------------+
|                      1. БЫСТРЫЕ ПРЕСЕТЫ                     |
|  [🤖 AI & Работа]  [📺 YouTube 4K]  [🎮 Discord]  [🛡️ РФ]  |
+-------------------------------------------------------------+
|                   2. КОНСТРУКТОР САБКИ                      |
|  Сервисы:                                                   |
|  [x] ChatGPT  [x] Claude  [x] Gemini  [x] Perplexity        |
|  [x] YouTube  [x] Discord [x] Instagram [x] Twitter         |
|                                                             |
|  Страны (выбрать нужные):                                   |
|  [🇩🇪 DE (1420)]  [🇳🇱 NL (980)]  [🇰🇿 KZ (430)]  [🇯🇵 JP (210)] |
|                                                             |
|  Макс. пинг: [-----------●-----] до 100 мс                  |
|  Кол-во ключей: (10) ( ● 20 ) (50)                         |
+-------------------------------------------------------------+
|                      3. ВЫДАЧА САБКИ                        |
|  Найдено серверов: 20                                       |
|                                                             |
|  [ 🚀 Открыть в Happ ]      [ ⚡ Импорт в Clash Meta ]       |
|  [ 📋 Скопировать URL ]      [ 📱 Показать QR-код ]         |
+-------------------------------------------------------------+
|              4. ПРЕДПРОСМОТР СЕРВЕРОВ (Список)              |
|  • TurboProbe · 🇩🇪 DE · Gemini · 32ms   [ChatGPT ✓] [YT ✓]   |
|  • TurboProbe · 🇳🇱 NL · ChatGPT · 28ms  [Claude ✓]  [YT ✓]   |
+-------------------------------------------------------------+
```

---

## 4. Диплинки для интеграции в 1 клик

Когда пользователь кликает на кнопки экспорта, фронтенд формирует URL:
```javascript
const subUrl = `https://api.turboprobe.workers.dev/sub?services=${selectedServices.join(',')}&country=${selectedCountries.join(',')}&limit=${limit}&max_ping=${maxPing}`;
```

### 1. Интеграция с Happ:
```javascript
const happDeepLink = `happ://subscribe?url=${encodeURIComponent(subUrl)}`;
// При клике: window.location.href = happDeepLink;
```

### 2. Интеграция с Clash Meta / Flclash / Clash Verge:
```javascript
const clashSubUrl = `${subUrl}&format=clash`;
const clashDeepLink = `clash://install-config?url=${encodeURIComponent(clashSubUrl)}&name=${encodeURIComponent('TurboProbe Custom')}`;
// При клике: window.location.href = clashDeepLink;
```

### 3. Копирование ссылки подписки:
```javascript
navigator.clipboard.writeText(subUrl);
// Показываем всплывающее уведомление (Toast): "Ссылка скопирована! Вставьте в v2rayNG / Hiddify / Streisand"
```

### 4. QR-Код:
Отрисовать модальное окно с QR-кодом строки `subUrl` (используя легкую библиотеку `qrcode.min.js`).

---

## 5. Требования к UI/UX и дизайну

1. **Стиль:** Современный Dark/Cyberpunk или Clean Minimalist (Tailwind CSS, темный фон `#0d1117`, аккуратные скругления `rounded-2xl`, неоновые/пастельные акценты `#6366f1` / `#10b981`).
2. **Адаптивность:** 100% Mobile-Friendly (удобные крупные кнопки для пальца на смартфонах).
3. **Реактивность:**
   * При переключении чекбоксов стран или сервисов внизу **в реальном времени** обновляется количество найденных ключей и превью-ссылка.
   * Кнопка «Скопировать» анимируется с галочкой `Скопировано!`.
4. **Интерактивный список стран:**
   * Страны подгружаются динамически из `/api/countries`.
   * Каждая страна отображается как чип: `[ 🇩🇪 Германия · 1420 ]` с флагом.
   * Кнопки «Выбрать все» / «Сбросить».

---

## 6. Рекомендуемый стек технологий для фронтенда

* **Вариант А (Single File / No Build):** Чистый `index.html` + `Tailwind CSS (CDN)` + `Alpine.js` или `Vue 3 (CDN)` + `QRCode.js`. Запускается мгновенно, не требует `npm install` и сборки.
* **Вариант Б (Modern Framework):** React / Next.js / Vite + Tailwind CSS + Lucide Icons + Canvas-Confetti.
