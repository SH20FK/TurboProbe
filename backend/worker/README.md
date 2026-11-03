# ⚡ TurboProbe Cloudflare Worker

Динамический генератор подписок на лету под любые комбинации сервисов, стран и протоколов.

### 🚀 Развертывание в Cloudflare (1 минута):
1. Установи Wrangler (если не установлен):
   ```bash
   npm install -g wrangler
   ```
2. Авторизуйся и опубликуй:
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```
3. Ссылка сразу станет доступна:
   `https://sub.turboprobe.workers.dev/sub`

Worker читает только актуальный `main/sub/nodes.json` без кэширования. Ошибка источника или пустой набор дают HTTP 503; старые зеркала и TXT не подставляются. Ответ содержит `X-TurboProbe-Version`, а для корректного снимка — `X-TurboProbe-Updated-At`. Новый проверенный снимок из Actions доступен при следующем запросе без повторного деплоя Worker.
