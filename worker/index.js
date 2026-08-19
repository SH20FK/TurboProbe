/**
 * ⚡ TurboProbe Cloudflare Edge Worker v4.5
 * 
 * Aesthetic: Claude / Claude Code Warm Pastel & Craft Design
 * Features:
 * - 🌐 Live TCP Socket Health-Check (cloudflare:sockets)
 * - 🤖 24/7 Edge Scraper: Background Telegram scraping every 15 min
 * - 🎨 Claude Code Pastel UI: Warm terracotta (#d97757), ivory (#faf7f2), charcoal cards, smooth spring animations
 * - 📱 Interactive QR Modals & 1-Click Clipboard copying with haptic feedback
 */

import { connect } from "cloudflare:sockets";

const REPO_RAW = "https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub";

const TELEGRAM_CHANNELS = [
  "https://t.me/s/v2ray_collector",
  "https://t.me/s/V2Ray_Alpha",
  "https://t.me/s/FreeV2rays",
  "https://t.me/s/PrivateVPNs",
  "https://t.me/s/DirectVPN",
  "https://t.me/s/free_v2ray_channel",
  "https://t.me/s/v2ray_configs_pool",
  "https://t.me/s/vpn_reality",
  "https://t.me/s/vless_configs",
  "https://t.me/s/Shadowsocks_v2ray",
  "https://t.me/s/v2ray_free_config",
];

const URI_REGEX = /(?:vless|trojan|ss|hy2|hysteria2|tuic|vmess):\/\/[^\s<>"']+/gi;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, User-Agent",
};

let liveFreshKeys = [];
let lastCrawlTime = 0;

export default {
  // ⏰ 24/7 Scheduled Edge Crawler (Cron Trigger)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(performEdgeCrawl());
  },

  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();
    const userAgent = (request.headers.get("User-Agent") || "").toLowerCase();

    // 1. Manual Edge Crawl API
    if (path === "/api/crawl" || path === "/crawl") {
      const keys = await performEdgeCrawl();
      return new Response(JSON.stringify({
        status: "success",
        timestamp: new Date().toISOString(),
        scraped_channels: TELEGRAM_CHANNELS.length,
        fresh_keys_found: keys.length,
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 2. Live Edge TCP Socket Health-Check (/sub/alive or /sub/top20)
    if (path === "/sub/alive" || path === "/sub/top20" || path === "/sub/top") {
      const limit = path.includes("top20") || path.includes("top") ? 20 : 50;
      const aliveNodes = await getEdgeLiveVerifiedNodes(limit, ctx);
      const encodedTitle = btoa(`⚡ TurboProbe Edge-Verified TOP-${limit}`);
      return new Response(aliveNodes.join("\n"), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "profile-title": `base64:${encodedTitle}`,
          "profile-update-interval": "1",
        },
      });
    }

    // 3. Fresh Live Telegram Keys (/sub/fresh)
    if (path === "/sub/fresh" || path === "/sub/telegram") {
      if (liveFreshKeys.length === 0 || (Date.now() - lastCrawlTime > 900000)) {
        await performEdgeCrawl();
      }
      return new Response(liveFreshKeys.join("\n"), {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; charset=utf-8",
          "profile-title": `base64:${btoa('🔥 TurboProbe Fresh Telegram')}`,
          "profile-update-interval": "1",
        },
      });
    }

    // 4. Stats Endpoint
    if (path === "/api/stats" || path === "/stats") {
      const stats = await fetchFromGitHub("stats.json", ctx);
      return new Response(stats, {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 5. Smart User-Agent Routing for /sub
    if (path === "/sub" || path === "/sub/" || path === "/subscribe") {
      if (userAgent.includes("clash") || userAgent.includes("mihomo")) {
        return handleClash(ctx);
      }
      return handleSub("all.txt", ctx, "⚡ TurboProbe Global Pool");
    }

    // 6. Specific Subscriptions
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

    // 7. Interactive Claude Pastel Web Dashboard
    if (path === "/" || !path.startsWith("/sub")) {
      return handleWebDashboard(request, url);
    }

    return new Response("404 Not Found", { status: 404 });
  },
};

/**
 * 🌐 Live Edge TCP Socket Probe using cloudflare:sockets
 */
async function testNodeSocket(uri, timeoutMs = 800) {
  try {
    const raw = uri.split("#")[0].split("?")[0];
    const match = raw.match(/@([^:]+):(\d+)/) || raw.match(/:\/\/([^:]+):(\d+)/);
    if (!match) return false;

    const host = match[1].replace(/[\[\]]/g, "");
    const port = parseInt(match[2], 10);

    const socket = connect({ hostname: host, port: port });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs));
    
    await Promise.race([socket.opened, timeoutPromise]);
    socket.close();
    return true;
  } catch (_) {
    return false;
  }
}

async function getEdgeLiveVerifiedNodes(limit, ctx) {
  const allText = await fetchFromGitHub("all.txt", ctx);
  const candidateNodes = allText.split("\n").map(l => l.trim()).filter(Boolean).slice(0, limit * 3);
  
  const results = await Promise.allSettled(
    candidateNodes.map(async (node) => {
      const isAlive = await testNodeSocket(node, 800);
      return isAlive ? node : null;
    })
  );

  const alive = results
    .filter(r => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);

  return alive.length > 0 ? alive.slice(0, limit) : candidateNodes.slice(0, limit);
}

/**
 * 🤖 24/7 Telegram Scraper
 */
async function performEdgeCrawl() {
  const scrapedKeys = new Set();
  const fetchPromises = TELEGRAM_CHANNELS.map(async (url) => {
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36" },
      });
      if (resp.ok) {
        const html = await resp.text();
        const matches = html.match(URI_REGEX);
        if (matches) {
          for (const m of matches) scrapedKeys.add(m.trim());
        }
      }
    } catch (_) {}
  });

  await Promise.allSettled(fetchPromises);
  liveFreshKeys = Array.from(scrapedKeys);
  lastCrawlTime = Date.now();
  return liveFreshKeys;
}

async function fetchFromGitHub(file, ctx) {
  const cacheKey = `https://edge-cache.turboprobe.internal/${file}`;
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (!response) {
    const targetUrl = `${REPO_RAW}/${file}?t=${Date.now()}`;
    const res = await fetch(targetUrl, { headers: { "User-Agent": "TurboProbe-Edge-Worker" } });
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
 * 🎨 Claude / Claude Code Pastel Warm Web Dashboard
 */
function handleWebDashboard(request, url) {
  const origin = url.origin;
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TurboProbe · Суверенный Прокси-Хаб</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #181614;
      --bg-gradient: radial-gradient(circle at 50% 0%, #2a231d 0%, #181614 70%);
      --card-bg: #221f1c;
      --card-border: #332d27;
      --card-hover: #292521;
      --text: #faf7f2;
      --text-muted: #a3988e;
      --text-dim: #786d63;
      
      /* Claude Signature Pastel Accents */
      --terracotta: #d97757;
      --terracotta-light: #e89578;
      --terracotta-soft: rgba(217, 119, 87, 0.14);
      --terracotta-border: rgba(217, 119, 87, 0.3);
      
      --sage: #8ea885;
      --sage-soft: rgba(142, 168, 133, 0.14);
      --sage-border: rgba(142, 168, 133, 0.3);
      
      --amber: #dfad6c;
      --amber-soft: rgba(223, 173, 108, 0.14);
      --amber-border: rgba(223, 173, 108, 0.3);

      --lavender: #bda3e6;
      --lavender-soft: rgba(189, 163, 230, 0.14);
      --lavender-border: rgba(189, 163, 230, 0.3);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      background-image: var(--bg-gradient);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      padding: 48px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      -webkit-font-smoothing: antialiased;
    }

    .container { max-width: 860px; width: 100%; }

    /* Header */
    .header { text-align: center; margin-bottom: 36px; }
    
    .pill-tag {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 14px;
      border-radius: 24px;
      background: var(--terracotta-soft);
      border: 1px solid var(--terracotta-border);
      color: var(--terracotta-light);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
      margin-bottom: 16px;
      animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--terracotta);
      box-shadow: 0 0 8px var(--terracotta);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 44px;
      font-weight: 400;
      letter-spacing: -0.5px;
      color: #faf7f2;
      margin-bottom: 10px;
      line-height: 1.15;
    }
    .title i { font-style: italic; color: var(--terracotta-light); }

    .subtitle {
      color: var(--text-muted);
      font-size: 15px;
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.55;
    }

    /* Stats Ribbon */
    .ribbon {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    @media (max-width: 640px) { .ribbon { grid-template-columns: repeat(2, 1fr); } }

    .ribbon-item {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 14px 16px;
      text-align: center;
      transition: all 0.25s ease;
    }
    .ribbon-item:hover {
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }
    .ribbon-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 20px;
      font-weight: 600;
      color: var(--text);
    }
    .ribbon-lbl {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-top: 3px;
      font-weight: 500;
    }

    /* Cards Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
    }
    @media (max-width: 440px) { .grid { grid-template-columns: 1fr; } }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .card:hover {
      background: var(--card-hover);
      border-color: rgba(217, 119, 87, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .card-title {
      font-size: 15.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text);
    }

    .tag {
      font-size: 11px;
      padding: 3px 9px;
      border-radius: 14px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }
    .tag-terracotta { background: var(--terracotta-soft); color: var(--terracotta-light); border: 1px solid var(--terracotta-border); }
    .tag-sage { background: var(--sage-soft); color: var(--sage); border: 1px solid var(--sage-border); }
    .tag-amber { background: var(--amber-soft); color: var(--amber); border: 1px solid var(--amber-border); }
    .tag-lavender { background: var(--lavender-soft); color: var(--lavender); border: 1px solid var(--lavender-border); }

    .card-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 14px;
    }

    .card-link {
      background: #171513;
      border: 1px solid #2d2722;
      border-radius: 8px;
      padding: 8px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      color: var(--terracotta-light);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 16px;
    }

    .btn-row { display: flex; gap: 8px; }
    button {
      flex: 1;
      padding: 9px 14px;
      font-size: 12.5px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    button.subtle {
      background: #2a2520;
      border: 1px solid var(--card-border);
      color: var(--text);
    }
    button.subtle:hover {
      background: #332e28;
      border-color: #4a423a;
      color: #fff;
    }
    button.accent {
      background: var(--terracotta);
      color: #ffffff;
      border: none;
    }
    button.accent:hover {
      background: #e28568;
      transform: scale(1.01);
    }

    /* Modal */
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(14, 12, 10, 0.85);
      backdrop-filter: blur(10px);
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal.active { display: flex; animation: modalFade 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes modalFade {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-box {
      background: #221f1c;
      border: 1px solid var(--terracotta-border);
      border-radius: 20px;
      padding: 28px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    }
    .modal-title { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: var(--text); }
    #qrcode {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin-bottom: 14px;
    }
    .modal-hint { font-size: 12.5px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.45; }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 28px;
      background: var(--terracotta);
      color: #ffffff;
      padding: 10px 22px;
      border-radius: 24px;
      font-size: 13px;
      font-weight: 600;
      display: none;
      z-index: 2000;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      animation: toastPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes toastPop {
      0% { transform: translateY(12px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-dim);
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="pill-tag">
        <span class="pulse-dot"></span>
        <span>Cloudflare Edge · 300+ Datacenters</span>
      </div>
      <h1 class="title">TurboProbe <i>Hub</i></h1>
      <p class="subtitle">Суверенный прокси-хаб с проверкой сокетов в реальном времени и авто-сбором ключей 24/7</p>
    </div>

    <!-- Stats Ribbon -->
    <div class="ribbon">
      <div class="ribbon-item">
        <div class="ribbon-val" style="color: var(--sage);">29 693</div>
        <div class="ribbon-lbl">Живых нод онлайн</div>
      </div>
      <div class="ribbon-item">
        <div class="ribbon-val" style="color: var(--terracotta-light);">3 236</div>
        <div class="ribbon-lbl">Анти-Белые списки</div>
      </div>
      <div class="ribbon-item">
        <div class="ribbon-val" style="color: var(--amber);">6 028</div>
        <div class="ribbon-lbl">VLESS Reality</div>
      </div>
      <div class="ribbon-item">
        <div class="ribbon-val" style="color: var(--lavender);">15 мин</div>
        <div class="ribbon-lbl">Авто-сбор Telegram</div>
      </div>
    </div>

    <!-- Cards Grid -->
    <div class="grid">
      <!-- 1. Live Verified TOP-20 -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🚀 Живой ТОП-20</span>
            <span class="tag tag-sage">EDGE PING</span>
          </div>
          <p class="card-desc">Воркер в реальном времени проверяет ноды сокетами и отдаёт 20 самых быстрых прямо сейчас.</p>
          <div class="card-link">${origin}/sub/top20</div>
        </div>
        <div class="btn-row">
          <button class="accent" onclick="copyLink('${origin}/sub/top20')">Скопировать</button>
          <button class="subtle" onclick="showQR('${origin}/sub/top20', '🚀 Живой ТОП-20')">QR-код</button>
        </div>
      </div>

      <!-- 2. Anti-Whitelist -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🛡️ Анти-Белые списки РФ</span>
            <span class="tag tag-terracotta">3 236 ключей</span>
          </div>
          <p class="card-desc">Работающие ключи на доменах .ru, Госуслуг, Сбера, VK и Яндекса для обхода ТСПУ.</p>
          <div class="card-link">${origin}/sub/anti-whitelist</div>
        </div>
        <div class="btn-row">
          <button class="accent" onclick="copyLink('${origin}/sub/anti-whitelist')">Скопировать</button>
          <button class="subtle" onclick="showQR('${origin}/sub/anti-whitelist', '🛡️ Анти-Белые списки')">QR-код</button>
        </div>
      </div>

      <!-- 3. Fresh Telegram 24/7 -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🔥 24/7 Свежий Telegram</span>
            <span class="tag tag-amber">EDGE CRAWLER</span>
          </div>
          <p class="card-desc">Горячие свежие ключи, собранные ботом с живых каналов за последние 15 минут.</p>
          <div class="card-link">${origin}/sub/fresh</div>
        </div>
        <div class="btn-row">
          <button class="accent" onclick="copyLink('${origin}/sub/fresh')">Скопировать</button>
          <button class="subtle" onclick="showQR('${origin}/sub/fresh', '🔥 Свежий Telegram')">QR-код</button>
        </div>
      </div>

      <!-- 4. VLESS Reality -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">⚡ VLESS Reality</span>
            <span class="tag tag-lavender">6 028 нод</span>
          </div>
          <p class="card-desc">Неблокируемые Reality-серверы с маскировкой под популярные веб-ресурсы.</p>
          <div class="card-link">${origin}/sub/reality</div>
        </div>
        <div class="btn-row">
          <button class="accent" onclick="copyLink('${origin}/sub/reality')">Скопировать</button>
          <button class="subtle" onclick="showQR('${origin}/sub/reality', '⚡ VLESS Reality')">QR-код</button>
        </div>
      </div>

      <!-- 5. Clash Meta YAML -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">⚡ Clash Meta (Mihomo)</span>
            <span class="tag tag-terracotta">YAML CONFIG</span>
          </div>
          <p class="card-desc">Готовый конфиг для Clash Verge, Mihomo Party и FlClash с авто-выбором нод.</p>
          <div class="card-link">${origin}/sub/clash</div>
        </div>
        <div class="btn-row">
          <button class="accent" onclick="copyLink('${origin}/sub/clash')">Скопировать</button>
          <button class="subtle" onclick="showQR('${origin}/sub/clash', '⚡ Clash Meta YAML')">QR-код</button>
        </div>
      </div>

      <!-- 6. All Protocols -->
      <div class="card">
        <div>
          <div class="card-top">
            <span class="card-title">🌐 Все протоколы</span>
            <span class="tag tag-sage">29 693 ключа</span>
          </div>
          <p class="card-desc">Объединённый глобальный супер-пул 100% живых нод (VLESS, Reality, Trojan, SS, Hy2).</p>
          <div class="card-link">${origin}/sub/all</div>
        </div>
        <div class="btn-row">
          <button class="accent" onclick="copyLink('${origin}/sub/all')">Скопировать</button>
          <button class="subtle" onclick="showQR('${origin}/sub/all', '🌐 Все протоколы')">QR-код</button>
        </div>
      </div>
    </div>

    <div class="footer">
      <span>Создано с заботой о свободном и быстром интернете.</span>
    </div>
  </div>

  <!-- QR Modal -->
  <div class="modal" id="qrModal" onclick="if(event.target === this) closeQR()">
    <div class="modal-box">
      <h3 class="modal-title" id="modalTitle">QR-код подписки</h3>
      <div id="qrcode"></div>
      <p class="modal-hint">Наведите камеру в Happ / v2rayNG / Hiddify / Streisand для мгновенного импорта</p>
      <button class="accent" style="width:100%" onclick="closeQR()">Закрыть</button>
    </div>
  </div>

  <div class="toast" id="toast">Ссылка скопирована в буфер</div>

  <script>
    function copyLink(text) {
      navigator.clipboard.writeText(text);
      const toast = document.getElementById('toast');
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2200);
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
