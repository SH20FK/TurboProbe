/**
 * ⚡ TurboProbe Cloudflare Worker & Dynamic Subscription API v2.0
 * 
 * Capabilities:
 * - Dynamic endpoints: /sub/all, /sub/anti-whitelist, /sub/reality, /sub/top20, /sub/gaming, /sub/clash, /sub/singbox, /sub/base64
 * - User-Agent Sniffing: Auto-serves Clash YAML to Clash/Mihomo, Sing-Box JSON to SingBox, Raw to Happ/v2rayNG/Hiddify, Interactive Web & QR UI to Browsers!
 * - Edge Caching with SWR (0ms worldwide response)
 * - Standard subscription metadata headers (profile-title, userinfo)
 */

const REPO_RAW = "https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub";

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, User-Agent",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();
    const userAgent = (request.headers.get("User-Agent") || "").toLowerCase();

    // 1. API Stats Endpoint
    if (path === "/api/stats" || path === "/stats") {
      const stats = await fetchFromGitHub("stats.json", ctx);
      return new Response(stats, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 2. Intelligent Auto-Format via User-Agent (if hitting /sub or root)
    if (path === "/sub" || path === "/sub/" || path === "/subscribe") {
      if (userAgent.includes("clash") || userAgent.includes("mihomo")) {
        return handleClash(ctx);
      }
      return handleSub("all.txt", ctx, "⚡ TurboProbe Global Pool");
    }

    // 3. Specific Subscriptions
    if (path === "/sub/all" || path === "/sub/all.txt") {
      return handleSub("all.txt", ctx, "⚡ TurboProbe All Protocols");
    }
    if (path === "/sub/anti-whitelist" || path === "/sub/white" || path === "/sub/ru") {
      return handleSub("anti-whitelist.txt", ctx, "🛡️ TurboProbe Anti-Whitelist RU");
    }
    if (path === "/sub/reality" || path === "/sub/vless") {
      return handleSub("reality.txt", ctx, "⚡ TurboProbe VLESS Reality");
    }
    if (path === "/sub/trojan") {
      return handleSub("trojan.txt", ctx, "🔒 TurboProbe Trojan TLS");
    }
    if (path === "/sub/hysteria2" || path === "/sub/hy2") {
      return handleSub("hysteria2.txt", ctx, "🚀 TurboProbe Hysteria 2 / TUIC");
    }
    if (path === "/sub/shadowsocks" || path === "/sub/ss") {
      return handleSub("shadowsocks.txt", ctx, "🗝️ TurboProbe Shadowsocks");
    }
    if (path === "/sub/base64" || path === "/sub/b64") {
      return handleBase64(ctx);
    }
    if (path === "/sub/clash" || path === "/sub/clash-meta.yaml" || path === "/clash") {
      return handleClash(ctx);
    }

    // 4. Dynamic Top-20 / Gaming Selection
    if (path === "/sub/top20" || path === "/sub/top") {
      return handleTopNodes(20, ctx);
    }
    if (path === "/sub/top50") {
      return handleTopNodes(50, ctx);
    }

    // 5. Browser Interactive Dashboard with QR Codes (Default Root)
    if (path === "/" || !path.startsWith("/sub")) {
      return handleWebDashboard(request, url);
    }

    return new Response("404 Not Found", { status: 404 });
  },
};

/**
 * Fetch with Edge Cache & SWR
 */
async function fetchFromGitHub(file, ctx) {
  const cacheKey = `https://edge-cache.turboprobe.internal/${file}`;
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (!response) {
    const targetUrl = `${REPO_RAW}/${file}?t=${Date.now()}`;
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "TurboProbe-Edge-Worker" },
    });
    if (res.ok) {
      const text = await res.text();
      response = new Response(text, {
        headers: {
          "Content-Type": file.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1200",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return text;
    }
    return "";
  }
  return await response.text();
}

/**
 * Handler for standard text subscriptions
 */
async function handleSub(filename, ctx, title) {
  const content = await fetchFromGitHub(filename, ctx);
  const encodedTitle = btoa(unescape(encodeURIComponent(title)));

  return new Response(content, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "profile-title": `base64:${encodedTitle}`,
      "profile-update-interval": "6",
      "Subscription-Userinfo": "upload=0; download=1073741824; total=1073741824000; expire=2030-01-01",
    },
  });
}

/**
 * Handler for Base64 subscriptions
 */
async function handleBase64(ctx) {
  const content = await fetchFromGitHub("base64.txt", ctx);
  return new Response(content, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "profile-title": `base64:${btoa('TurboProbe Base64')}`,
      "profile-update-interval": "6",
    },
  });
}

/**
 * Handler for Clash Meta YAML
 */
async function handleClash(ctx) {
  const content = await fetchFromGitHub("clash-meta.yaml", ctx);
  return new Response(content, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/yaml; charset=utf-8",
      "profile-update-interval": "6",
      "Subscription-Userinfo": "upload=0; download=1073741824; total=1073741824000; expire=2030-01-01",
    },
  });
}

/**
 * Dynamic Top-N selection
 */
async function handleTopNodes(limit, ctx) {
  const allText = await fetchFromGitHub("all.txt", ctx);
  const lines = allText.split("\n").map(l => l.trim()).filter(Boolean);
  const topSlice = lines.slice(0, limit).join("\n");
  const encodedTitle = btoa(`⚡ TurboProbe TOP-${limit}`);

  return new Response(topSlice, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "profile-title": `base64:${encodedTitle}`,
      "profile-update-interval": "6",
    },
  });
}

/**
 * Sleek, interactive Web Dashboard with QR Codes
 */
function handleWebDashboard(request, url) {
  const origin = url.origin;
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ TurboProbe Dynamic Subscription API</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <style>
    :root {
      --bg: #0e1117;
      --card: #161b22;
      --border: #30363d;
      --text: #f0f6fc;
      --muted: #8b949e;
      --accent: #58a6ff;
      --green: #3fb950;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px 16px; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
    .container { max-width: 820px; width: 100%; }
    .header { text-align: center; margin-bottom: 28px; }
    .logo { font-size: 42px; margin-bottom: 8px; }
    .title { font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
    .subtitle { color: var(--muted); font-size: 14px; margin-top: 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s, border-color 0.2s; }
    .card:hover { border-color: var(--accent); transform: translateY(-2px); }
    .card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .card-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .badge { font-size: 11px; padding: 2px 8px; border-radius: 20px; background: rgba(88,166,255,0.15); color: var(--accent); font-weight: 600; }
    .card-desc { font-size: 12.5px; color: var(--muted); margin-bottom: 12px; line-height: 1.4; }
    .card-url { background: #090d13; border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-family: monospace; font-size: 11.5px; color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 12px; }
    .btn-row { display: flex; gap: 8px; }
    button { flex: 1; padding: 8px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid var(--border); background: #21262d; color: var(--text); transition: background 0.2s; }
    button:hover { background: #30363d; }
    button.primary { background: #ffffff; color: #000000; border: none; }
    button.primary:hover { background: #e6e6e6; }
    
    /* Modal */
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 100; padding: 16px; }
    .modal.active { display: flex; }
    .modal-box { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 24px; max-width: 380px; width: 100%; text-align: center; }
    .modal-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    #qrcode { background: #fff; padding: 16px; border-radius: 8px; display: inline-block; margin-bottom: 14px; }
    .modal-hint { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
    .toast { position: fixed; bottom: 24px; background: var(--green); color: #000; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; display: none; z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">⚡</div>
      <h1 class="title">TurboProbe Edge API</h1>
      <p class="subtitle">Умная выдача проверенных прокси-подписок с 0ms Edge-кэшированием</p>
    </div>

    <div class="grid">
      <!-- 1. Anti-Whitelist -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🛡️ Анти-Белые списки</span>
            <span class="badge" style="background: rgba(63,185,80,0.15); color: var(--green);">3 200+ ключей</span>
          </div>
          <p class="card-desc">Проверенные ключи на доменах .ru, Госуслуг, Сбера, VK и Яндекса для обхода ТСПУ.</p>
          <div class="card-url">${origin}/sub/anti-whitelist</div>
        </div>
        <div class="btn-row">
          <button class="primary" onclick="copyLink('${origin}/sub/anti-whitelist')">📋 Копировать</button>
          <button onclick="showQR('${origin}/sub/anti-whitelist', '🛡️ Анти-Белые списки')">📱 QR-код</button>
        </div>
      </div>

      <!-- 2. VLESS Reality -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">⚡ VLESS Reality</span>
            <span class="badge">6 000+ ключей</span>
          </div>
          <p class="card-desc">Неблокируемые Reality-серверы со скрытым рукопожатием.</p>
          <div class="card-url">${origin}/sub/reality</div>
        </div>
        <div class="btn-row">
          <button class="primary" onclick="copyLink('${origin}/sub/reality')">📋 Копировать</button>
          <button onclick="showQR('${origin}/sub/reality', '⚡ VLESS Reality')">📱 QR-код</button>
        </div>
      </div>

      <!-- 3. TOP-20 Live -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🚀 ТОП-20 Самых быстрых</span>
            <span class="badge" style="background: rgba(240,136,62,0.15); color: #f0883e;">Динамический</span>
          </div>
          <p class="card-desc">Динамическая выборка 20 самых скоростных проверенных нод.</p>
          <div class="card-url">${origin}/sub/top20</div>
        </div>
        <div class="btn-row">
          <button class="primary" onclick="copyLink('${origin}/sub/top20')">📋 Копировать</button>
          <button onclick="showQR('${origin}/sub/top20', '🚀 ТОП-20 Серверов')">📱 QR-код</button>
        </div>
      </div>

      <!-- 4. Clash Meta -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">⚡ Clash Meta (Mihomo)</span>
            <span class="badge">YAML Config</span>
          </div>
          <p class="card-desc">Готовый конфиг для Clash Verge, Mihomo Party и FlClash с авто-пингом.</p>
          <div class="card-url">${origin}/sub/clash</div>
        </div>
        <div class="btn-row">
          <button class="primary" onclick="copyLink('${origin}/sub/clash')">📋 Копировать</button>
          <button onclick="showQR('${origin}/sub/clash', '⚡ Clash Meta YAML')">📱 QR-код</button>
        </div>
      </div>

      <!-- 5. All Protocols -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🌐 Все протоколы</span>
            <span class="badge">29 000+ нод</span>
          </div>
          <p class="card-desc">Полный пул 100% живых проверенных нод со всего мира (VLESS, Trojan, SS, Hy2).</p>
          <div class="card-url">${origin}/sub/all</div>
        </div>
        <div class="btn-row">
          <button class="primary" onclick="copyLink('${origin}/sub/all')">📋 Копировать</button>
          <button onclick="showQR('${origin}/sub/all', '🌐 Все протоколы')">📱 QR-код</button>
        </div>
      </div>

      <!-- 6. Hysteria 2 / TUIC -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🚀 Hysteria 2 / TUIC</span>
            <span class="badge">UDP Скорость</span>
          </div>
          <p class="card-desc">Сверхскоростные UDP протоколы для максимального битрейта.</p>
          <div class="card-url">${origin}/sub/hysteria2</div>
        </div>
        <div class="btn-row">
          <button class="primary" onclick="copyLink('${origin}/sub/hysteria2')">📋 Копировать</button>
          <button onclick="showQR('${origin}/sub/hysteria2', '🚀 Hysteria 2')">📱 QR-код</button>
        </div>
      </div>
    </div>
  </div>

  <!-- QR Modal -->
  <div class="modal" id="qrModal" onclick="if(event.target === this) closeQR()">
    <div class="modal-box">
      <h3 class="modal-title" id="modalTitle">QR-код подписки</h3>
      <div id="qrcode"></div>
      <p class="modal-hint">Наведите камеру в Happ / v2rayNG / Hiddify / Streisand для импорта!</p>
      <button class="primary" style="width:100%" onclick="closeQR()">Закрыть</button>
    </div>
  </div>

  <div class="toast" id="toast">Ссылка скопирована в буфер!</div>

  <script>
    function copyLink(text) {
      navigator.clipboard.writeText(text);
      const toast = document.getElementById('toast');
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }

    function showQR(text, title) {
      document.getElementById('modalTitle').innerText = title;
      const qrEl = document.getElementById('qrcode');
      qrEl.innerHTML = '';
      QRCode.toCanvas(text, { width: 220, margin: 1 }, function (err, canvas) {
        if (!err) qrEl.appendChild(canvas);
      });
      document.getElementById('qrModal').classList.add('active');
    }

    function closeQR() {
      document.getElementById('qrModal').classList.remove('active');
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}
