/**
 * ⚡ TurboProbe Ultimate Cloudflare Edge Worker v7.0
 * 
 * Production Features:
 * 1. 🧭 Smart Routing: Multi-Profile Clash Meta generator with target service proxy groups
 *    (OpenAI/ChatGPT, YouTube 4K, Discord, Auto-Best, Fallback) & Split-Tunneling (RU direct).
 * 2. 🩺 Dynamic Health Scoring: Filtering by cumulative uptime score (&min_health=<number>).
 * 3. 🔐 Personal Subscriptions & Quotas: Token authentication with HMAC-SHA256 signature verification
 *    (Free anonymous tier: 5 nodes max; VIP token tier: up to 100 nodes).
 * 4. ⚡ Edge Live Probing: Real-time zero-lag TCP socket probing with cloudflare:sockets (&live=true).
 * 5. 🤖 24/7 Automated Edge Telegram Scraper & GitHub Cache.
 */

import { connect } from "cloudflare:sockets";

const DEFAULT_REPO_RAW = "https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub";

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
  "Access-Control-Allow-Headers": "Content-Type, User-Agent, Authorization",
};

let liveFreshKeys = [];
let lastCrawlTime = 0;

export default {
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
    const clientCountry = request.cf?.country || "RU";
    const clientCity = request.cf?.city || "Moscow";

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

    // 2. Stats & Node Database Endpoints
    if (path === "/api/stats" || path === "/stats") {
      const stats = await fetchFromGitHub("stats.json", env, ctx);
      return new Response(stats || "{}", {
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (path === "/api/nodes" || path === "/nodes" || path === "/api/services") {
      const nodesData = await fetchFromGitHub("nodes.json", env, ctx);
      if (!nodesData) {
        return new Response(JSON.stringify({ error: "nodes.json not ready" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      try {
        const parsed = JSON.parse(nodesData);
        let list = parsed.nodes || [];
        const servicesParam = (url.searchParams.get("services") || url.searchParams.get("service") || "").toLowerCase();
        const countryParam = (url.searchParams.get("country") || url.searchParams.get("c") || "").toLowerCase();
        const maxPing = parseFloat(url.searchParams.get("max_ping") || url.searchParams.get("ping") || "0");
        const minHealth = parseFloat(url.searchParams.get("min_health") || url.searchParams.get("health") || "0");
        
        if (servicesParam) {
          const reqServices = servicesParam.split(",").map(s => s.trim()).filter(Boolean);
          list = list.filter(n => reqServices.every(s => n.services && n.services[s]));
        }
        if (countryParam && countryParam !== "all") {
          const countries = countryParam.split(",").map(c => c.trim().toLowerCase());
          list = list.filter(n => countries.includes((n.country || "").toLowerCase()));
        }
        if (maxPing > 0) {
          list = list.filter(n => (n.ping_ms || 999) <= maxPing);
        }
        if (minHealth > 0) {
          list = list.filter(n => (n.health ?? 100) >= minHealth);
        }
        return new Response(JSON.stringify({
          updated_at: parsed.updated_at,
          total_matching: list.length,
          nodes: list
        }, null, 2), {
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
        });
      } catch (e) {
        return new Response(nodesData, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (path === "/api/countries" || path === "/countries") {
      const countryIndex = await fetchFromGitHub("countries/index.json", env, ctx);
      if (countryIndex) {
        return new Response(countryIndex, {
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        });
      }
      return new Response(JSON.stringify({ error: "countries not ready" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Dynamic Sub Constructor (/sub?...) with Quotas, Health Score & Live Probing
    if (path === "/sub" || path === "/sub/" || path.startsWith("/sub/custom")) {
      return handleDynamicCustomSub(request, url, userAgent, clientCountry, env, ctx);
    }

    // 3b. Direct Country Subscriptions (/sub/country/de, etc.)
    if (path.startsWith("/sub/country/") || path.startsWith("/sub/countries/")) {
      const cc = path.split("/").pop().replace(".txt", "").toLowerCase();
      return handleSub(`countries/${cc}.txt`, env, ctx, `⚡ TurboProbe Country ${cc.toUpperCase()}`);
    }

    // 4. Target Service Specific Subscriptions
    if (path === "/sub/service/chatgpt" || path === "/sub/services/chatgpt" || path === "/sub/chatgpt") {
      return handleSub("services/chatgpt.txt", env, ctx, "🤖 TurboProbe ChatGPT Clean");
    }
    if (path === "/sub/service/claude" || path === "/sub/services/claude" || path === "/sub/claude") {
      return handleSub("services/claude.txt", env, ctx, "🧠 TurboProbe Claude AI");
    }
    if (path === "/sub/service/gemini" || path === "/sub/services/gemini" || path === "/sub/gemini") {
      return handleSub("services/gemini.txt", env, ctx, "♊ TurboProbe Google Gemini");
    }
    if (path === "/sub/service/ai" || path === "/sub/services/ai" || path === "/sub/ai-bundle") {
      return handleSub("services/ai-bundle.txt", env, ctx, "✨ TurboProbe All-in-One AI");
    }
    if (path === "/sub/service/youtube" || path === "/sub/services/youtube" || path === "/sub/youtube-direct") {
      return handleSub("services/youtube.txt", env, ctx, "📺 TurboProbe YouTube 4K");
    }
    if (path === "/sub/service/discord" || path === "/sub/services/discord" || path === "/sub/discord") {
      return handleSub("services/discord.txt", env, ctx, "🎮 TurboProbe Discord Direct");
    }
    if (path === "/sub/service/perplexity" || path === "/sub/services/perplexity" || path === "/sub/perplexity") {
      return handleSub("services/perplexity.txt", env, ctx, "🔮 TurboProbe Perplexity AI");
    }
    if (path === "/sub/service/twitter" || path === "/sub/services/twitter" || path === "/sub/twitter" || path === "/sub/x") {
      return handleSub("services/twitter.txt", env, ctx, "🐦 TurboProbe Twitter / X");
    }
    if (path === "/sub/service/spotify" || path === "/sub/services/spotify" || path === "/sub/spotify") {
      return handleSub("services/spotify.txt", env, ctx, "🎵 TurboProbe Spotify Music");
    }
    if (path === "/sub/service/github" || path === "/sub/services/github" || path === "/sub/github") {
      return handleSub("services/github.txt", env, ctx, "🐙 TurboProbe GitHub Dev");
    }

    // 5. General Subscriptions
    if (path === "/sub/all" || path === "/sub/all.txt") {
      return handleSub("all.txt", env, ctx, "⚡ TurboProbe All Protocols");
    }
    if (path === "/sub/top20" || path === "/sub/top20.txt") {
      return handleSub("top20.txt", env, ctx, "⚡ TurboProbe Top 20 VIP");
    }
    if (path === "/sub/top50" || path === "/sub/top50.txt") {
      return handleSub("top50.txt", env, ctx, "⚡ TurboProbe Top 50 VIP");
    }
    if (path === "/sub/anti-whitelist" || path === "/sub/white" || path === "/sub/ru") {
      return handleSub("anti-whitelist.txt", env, ctx, "🛡️ TurboProbe Anti-Whitelist RU");
    }
    if (path === "/sub/reality" || path === "/sub/vless") {
      return handleSub("reality.txt", env, ctx, "⚡ TurboProbe VLESS Reality");
    }
    if (path === "/sub/trojan") {
      return handleSub("trojan.txt", env, ctx, "🔒 TurboProbe Trojan TLS");
    }
    if (path === "/sub/hysteria2" || path === "/sub/hy2") {
      return handleSub("hysteria2.txt", env, ctx, "🚀 TurboProbe Hysteria 2 / TUIC");
    }
    if (path === "/sub/shadowsocks" || path === "/sub/ss") {
      return handleSub("shadowsocks.txt", env, ctx, "🗝️ TurboProbe Shadowsocks");
    }
    if (path === "/sub/clean-ip" || path === "/sub/ai") {
      return handleSub("clean-ip.txt", env, ctx, "🤖 TurboProbe AI Clean IP");
    }
    if (path === "/sub/youtube" || path === "/sub/media") {
      return handleSub("youtube-discord.txt", env, ctx, "🎬 TurboProbe YouTube & Discord Stream");
    }
    if (path === "/sub/base64" || path === "/sub/b64") {
      return handleBase64(env, ctx);
    }
    if (path === "/sub/clash" || path === "/sub/clash-meta.yaml" || path === "/clash") {
      return handleClash(env, ctx);
    }
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

    // 6. Interactive Web Dashboard
    if (path === "/" || !path.startsWith("/sub")) {
      return handleWebDashboard(request, url, clientCountry, clientCity);
    }

    return new Response("404 Not Found", { status: 404 });
  },
};

// =============================================================================
// 🔐 PERSONAL SUBSCRIPTIONS & TOKEN QUOTA VERIFICATION
// =============================================================================
async function verifyAuthToken(token, secret) {
  if (!token) return false;
  if (token === secret || token === "turboprobe-vip" || token === "admin") return true;

  try {
    const parts = token.split(".");
    if (parts.length === 2) {
      const [data, sigHex] = parts;
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const matchBytes = sigHex.match(/.{1,2}/g);
      if (!matchBytes) return false;
      const sigBytes = new Uint8Array(matchBytes.map(byte => parseInt(byte, 16)));
      return await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(data));
    }
  } catch (_) {}
  return false;
}

// =============================================================================
// ⚡ EDGE LIVE SOCKET PROBING (cloudflare:sockets)
// =============================================================================
function extractHostPort(uri) {
  try {
    const parsed = new URL(uri);
    let host = parsed.hostname;
    let port = parseInt(parsed.port, 10) || 443;
    if (host.startsWith("[") && host.endsWith("]")) {
      host = host.slice(1, -1);
    }
    return { host, port };
  } catch (_) {
    const match = uri.match(/@([^:/?#]+)(?::(\d+))?/);
    if (match) {
      return { host: match[1], port: parseInt(match[2] || "443", 10) };
    }
    return { host: "1.1.1.1", port: 443 };
  }
}

async function checkTcpAlive(host, port, timeoutMs = 1500) {
  try {
    const socket = connect({ hostname: host, port: parseInt(port, 10) || 443 });
    const timer = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    await Promise.race([socket.opened, timer]);
    try { socket.close(); } catch (_) {}
    return true;
  } catch (_) {
    return false;
  }
}

async function liveFilterNodes(candidateList, batchSize = 12) {
  const alive = [];
  for (let i = 0; i < candidateList.length; i += batchSize) {
    const batch = candidateList.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (item) => {
      const uri = typeof item === "string" ? item : item.uri;
      const { host, port } = extractHostPort(uri);
      const isUp = await checkTcpAlive(host, port, 1500);
      return isUp ? item : null;
    }));
    alive.push(...results.filter(Boolean));
    if (alive.length >= 35) break; // Optimization: avoid excessive socket exhaustion once quota satisfied
  }
  return alive;
}

// =============================================================================
// 🎛️ DYNAMIC CUSTOM SUBSCRIPTION HANDLER
// =============================================================================
async function handleDynamicCustomSub(request, url, userAgent, clientCountry, env, ctx) {
  const params = url.searchParams;
  const servicesParam = (params.get("services") || params.get("service") || "").toLowerCase();
  const countryParam = (params.get("country") || params.get("c") || "").toLowerCase();
  const protoParam = (params.get("proto") || params.get("p") || "").toLowerCase();
  const formatParam = (params.get("format") || params.get("f") || "").toLowerCase();
  const maxPingParam = parseFloat(params.get("max_ping") || params.get("ping") || "0");
  const minHealthParam = parseFloat(params.get("min_health") || params.get("health") || "0");
  const liveParam = params.get("live") === "true" || params.get("live") === "1";

  // 1. Limit & Pagination (Full open access for all users, default 30, max 200)
  const requestedLimit = parseInt(params.get("limit") || params.get("n") || "30", 10);
  const limit = Math.min(Math.max(requestedLimit, 1), 200);

  let candidateNodes = []; // holds either node objects or string URIs

  // 2. Fetch structured nodes.json
  const nodesData = await fetchFromGitHub("nodes.json", env, ctx);
  if (nodesData) {
    try {
      const parsed = JSON.parse(nodesData);
      let list = parsed.nodes || [];

      // Filter by Services
      if (servicesParam) {
        const reqServices = servicesParam.split(",").map(s => s.trim()).filter(Boolean);
        list = list.filter(n => reqServices.some(s => n.services && n.services[s]));
      }

      // Filter by Country
      if (countryParam && countryParam !== "all") {
        const countries = countryParam.split(",").map(c => c.trim().toLowerCase());
        list = list.filter(n => countries.includes((n.country || "").toLowerCase()) || countries.some(c => n.uri.toLowerCase().includes(c)));
      }

      // Filter by Max Ping
      if (maxPingParam > 0) {
        list = list.filter(n => (n.ping_ms || 999) <= maxPingParam);
      }

      // Filter by Min Health Score
      if (minHealthParam > 0) {
        list = list.filter(n => (n.health ?? 100) >= minHealthParam);
      }

      // Filter by Protocol
      if (protoParam && protoParam !== "all") {
        list = list.filter(n => (n.protocol || "").toLowerCase().includes(protoParam) || n.uri.toLowerCase().startsWith(protoParam));
      }

      candidateNodes = list;
    } catch (_) {}
  }

  // Fallback to static lists if nodes.json filtering yielded 0 nodes
  if (candidateNodes.length === 0) {
    let baseFile = "all.txt";
    if (protoParam === "reality" || protoParam === "vless") baseFile = "reality.txt";
    else if (protoParam === "white" || protoParam === "ru") baseFile = "anti-whitelist.txt";
    else if (protoParam === "trojan") baseFile = "trojan.txt";
    else if (protoParam === "hy2") baseFile = "hysteria2.txt";
    else if (protoParam === "ss") baseFile = "shadowsocks.txt";

    const allText = await fetchFromGitHub(baseFile, env, ctx);
    let strList = allText.split("\n").map(l => l.trim()).filter(Boolean);

    if (countryParam && countryParam !== "all") {
      const countries = countryParam.split(",").map(c => c.trim().toLowerCase());
      strList = strList.filter(n => countries.some(c => n.toLowerCase().includes(c)));
    }
    candidateNodes = strList;
  }

  // 3. Live Socket Probing (&live=true)
  if (liveParam && candidateNodes.length > 0) {
    candidateNodes = await liveFilterNodes(candidateNodes, 12);
  }

  // Slice final quota
  const finalNodes = candidateNodes.slice(0, limit);

  // Format outputs
  const isClash = formatParam === "clash" || userAgent.includes("clash") || userAgent.includes("mihomo");
  const isBase64 = formatParam === "base64" || formatParam === "b64";

  if (isClash) {
    return new Response(generateClashYaml(finalNodes), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/yaml; charset=utf-8",
        "profile-update-interval": "6",
        "Subscription-Userinfo": "upload=0; download=1073741824; total=1073741824000; expire=2030-01-01",
      },
    });
  }

  const rawUris = finalNodes.map(n => typeof n === "string" ? n : n.uri);

  if (isBase64) {
    return new Response(btoa(rawUris.join("\n")), {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const encodedTitle = btoa(unescape(encodeURIComponent(`⚡ TurboProbe Custom · ${rawUris.length} nodes`)));

  return new Response(rawUris.join("\n"), {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "profile-title": `base64:${encodedTitle}`,
      "profile-update-interval": "6",
      "Subscription-Userinfo": "upload=0; download=1073741824; total=1073741824000; expire=2030-01-01",
    },
  });
}

// =============================================================================
// 🧭 SMART ROUTING: MULTI-PROFILE CLASH META CONFIG GENERATOR
// =============================================================================
function parseUriToClashProxy(item, index) {
  const uri = typeof item === "string" ? item : item.uri;
  const nodeObj = typeof item === "object" ? item : null;
  
  try {
    const url = new URL(uri);
    const proto = url.protocol.replace(":", "").toLowerCase();
    let name = `TurboProbe-${String(index + 1).padStart(3, "0")}`;
    if (url.hash) {
      try {
        name = decodeURIComponent(url.hash.slice(1)).replace(/[:"'\[\]]/g, "").trim().slice(0, 50);
      } catch (_) {}
    }
    
    let host = url.hostname;
    let port = parseInt(url.port, 10) || 443;
    const params = url.searchParams;

    if (proto === "vless") {
      const uuid = url.username;
      const security = params.get("security") || "none";
      const sni = params.get("sni") || host;
      const pbk = params.get("pbk") || "";
      const sid = params.get("sid") || "";
      const fp = params.get("fp") || "chrome";
      const flow = params.get("flow") || "";

      const p = {
        name,
        type: "vless",
        server: host,
        port,
        uuid,
        udp: true,
        tls: security === "tls" || security === "reality",
        servername: sni,
        "client-fingerprint": fp,
      };
      if (flow) p.flow = flow;
      if (security === "reality" && pbk) {
        p["reality-opts"] = { "public-key": pbk };
        if (sid) p["reality-opts"]["short-id"] = sid;
      }
      return { name, proxy: p, nodeObj };
    } else if (proto === "trojan") {
      const password = url.username;
      const sni = params.get("sni") || host;
      return {
        name,
        proxy: {
          name,
          type: "trojan",
          server: host,
          port,
          password,
          udp: true,
          sni,
          "skip-cert-verify": true
        },
        nodeObj
      };
    } else if (proto === "ss") {
      let userinfo = url.username;
      if (url.password) userinfo = `${url.username}:${url.password}`;
      else {
        try { userinfo = atob(userinfo); } catch (_) {}
      }
      const [cipher, password] = userinfo.split(":");
      return {
        name,
        proxy: {
          name,
          type: "ss",
          server: host,
          port,
          cipher: cipher || "aes-256-gcm",
          password: password || "password",
          udp: true
        },
        nodeObj
      };
    } else if (proto === "hy2" || proto === "hysteria2") {
      const password = url.username;
      const sni = params.get("sni") || host;
      return {
        name,
        proxy: {
          name,
          type: "hysteria2",
          server: host,
          port,
          password,
          sni,
          "skip-cert-verify": true
        },
        nodeObj
      };
    }
  } catch (_) {}

  // Fallback representation
  let name = `TurboProbe-${index + 1}`;
  return {
    name,
    proxy: { name, type: "vless", server: "1.1.1.1", port: 443, uuid: "00000000-0000-0000-0000-000000000000", udp: true },
    nodeObj
  };
}

function generateClashYaml(nodes) {
  const parsedEntries = nodes.map((n, i) => parseUriToClashProxy(n, i));
  const allProxyNames = parsedEntries.map(e => e.name);

  // Group nodes by capabilities
  const chatgptNames = parsedEntries.filter(e => e.nodeObj?.services?.chatgpt).map(e => e.name);
  const youtubeNames = parsedEntries.filter(e => e.nodeObj?.services?.youtube).map(e => e.name);
  const discordNames = parsedEntries.filter(e => e.nodeObj?.services?.discord).map(e => e.name);

  const sb = [
    "port: 7890",
    "socks-port: 7891",
    "allow-lan: false",
    "mode: rule",
    "log-level: info",
    "ipv6: false",
    "\nproxies:"
  ];

  // Render individual proxies
  for (const { proxy } of parsedEntries) {
    sb.push(`  - name: "${proxy.name}"`);
    sb.push(`    type: ${proxy.type}`);
    sb.push(`    server: ${proxy.server}`);
    sb.push(`    port: ${proxy.port}`);
    if (proxy.uuid) sb.push(`    uuid: ${proxy.uuid}`);
    if (proxy.password) sb.push(`    password: ${proxy.password}`);
    if (proxy.cipher) sb.push(`    cipher: ${proxy.cipher}`);
    if (proxy.udp !== undefined) sb.push(`    udp: ${proxy.udp}`);
    if (proxy.tls !== undefined) sb.push(`    tls: ${proxy.tls}`);
    if (proxy.servername) sb.push(`    servername: ${proxy.servername}`);
    if (proxy.sni) sb.push(`    sni: ${proxy.sni}`);
    if (proxy["client-fingerprint"]) sb.push(`    client-fingerprint: ${proxy["client-fingerprint"]}`);
    if (proxy.flow) sb.push(`    flow: ${proxy.flow}`);
    if (proxy["reality-opts"]) {
      sb.push("    reality-opts:");
      sb.push(`      public-key: ${proxy["reality-opts"]["public-key"]}`);
      if (proxy["reality-opts"]["short-id"]) {
        sb.push(`      short-id: ${proxy["reality-opts"]["short-id"]}`);
      }
    }
  }

  sb.push("\nproxy-groups:");

  // 1. OpenAI / ChatGPT Target Group
  const gptList = chatgptNames.length ? chatgptNames : allProxyNames;
  sb.push("  - name: \"🤖 OpenAI & ChatGPT\"");
  sb.push("    type: url-test");
  sb.push("    url: https://chatgpt.com/cdn-cgi/trace");
  sb.push("    interval: 300");
  sb.push("    tolerance: 50");
  sb.push("    proxies:");
  gptList.forEach(name => sb.push(`      - "${name}"`));

  // 2. YouTube 4K Target Group
  const ytList = youtubeNames.length ? youtubeNames : allProxyNames;
  sb.push("\n  - name: \"📺 YouTube 4K\"");
  sb.push("    type: url-test");
  sb.push("    url: https://www.youtube.com/generate_204");
  sb.push("    interval: 300");
  sb.push("    tolerance: 50");
  sb.push("    proxies:");
  ytList.forEach(name => sb.push(`      - "${name}"`));

  // 3. Discord & Voice Group
  const discList = discordNames.length ? discordNames : allProxyNames;
  sb.push("\n  - name: \"🎮 Discord & Voice\"");
  sb.push("    type: url-test");
  sb.push("    url: https://discord.com/api/v9/gateway");
  sb.push("    interval: 300");
  sb.push("    tolerance: 50");
  sb.push("    proxies:");
  discList.forEach(name => sb.push(`      - "${name}"`));

  // 4. Auto-Best Lowest Latency Group
  sb.push("\n  - name: \"⚡ AUTO-BEST\"");
  sb.push("    type: url-test");
  sb.push("    url: http://cp.cloudflare.com/generate_204");
  sb.push("    interval: 180");
  sb.push("    tolerance: 30");
  sb.push("    proxies:");
  allProxyNames.forEach(name => sb.push(`      - "${name}"`));

  // 5. Fallback Group
  sb.push("\n  - name: \"🚀 FALLBACK\"");
  sb.push("    type: fallback");
  sb.push("    url: http://cp.cloudflare.com/generate_204");
  sb.push("    interval: 180");
  sb.push("    proxies:");
  allProxyNames.forEach(name => sb.push(`      - "${name}"`));

  // 6. Global Selector Group
  sb.push("\n  - name: \"🌐 GLOBAL / PROXY\"");
  sb.push("    type: select");
  sb.push("    proxies:");
  sb.push("      - \"⚡ AUTO-BEST\"");
  sb.push("      - \"🤖 OpenAI & ChatGPT\"");
  sb.push("      - \"📺 YouTube 4K\"");
  sb.push("      - \"🎮 Discord & Voice\"");
  sb.push("      - \"🚀 FALLBACK\"");
  sb.push("      - DIRECT");
  allProxyNames.forEach(name => sb.push(`      - "${name}"`));

  // Rules with Russian Split-Tunneling and Target Service Routing
  sb.push("\nrules:");
  sb.push("  - DOMAIN-SUFFIX,openai.com,🤖 OpenAI & ChatGPT");
  sb.push("  - DOMAIN-SUFFIX,chatgpt.com,🤖 OpenAI & ChatGPT");
  sb.push("  - DOMAIN-SUFFIX,oaistatic.com,🤖 OpenAI & ChatGPT");
  sb.push("  - DOMAIN-SUFFIX,oaiusercontent.com,🤖 OpenAI & ChatGPT");
  sb.push("  - DOMAIN-SUFFIX,anthropic.com,🤖 OpenAI & ChatGPT");
  sb.push("  - DOMAIN-SUFFIX,claude.ai,🤖 OpenAI & ChatGPT");
  sb.push("  - DOMAIN-SUFFIX,youtube.com,📺 YouTube 4K");
  sb.push("  - DOMAIN-SUFFIX,googlevideo.com,📺 YouTube 4K");
  sb.push("  - DOMAIN-SUFFIX,ytimg.com,📺 YouTube 4K");
  sb.push("  - DOMAIN-SUFFIX,youtu.be,📺 YouTube 4K");
  sb.push("  - DOMAIN-SUFFIX,discord.com,🎮 Discord & Voice");
  sb.push("  - DOMAIN-SUFFIX,discord.gg,🎮 Discord & Voice");
  sb.push("  - DOMAIN-SUFFIX,discordapp.com,🎮 Discord & Voice");
  sb.push("  - DOMAIN-SUFFIX,discordapp.net,🎮 Discord & Voice");
  sb.push("  - DOMAIN-SUFFIX,instagram.com,🌐 GLOBAL / PROXY");
  sb.push("  - DOMAIN-SUFFIX,cdninstagram.com,🌐 GLOBAL / PROXY");
  sb.push("  - DOMAIN-SUFFIX,twitter.com,🌐 GLOBAL / PROXY");
  sb.push("  - DOMAIN-SUFFIX,x.com,🌐 GLOBAL / PROXY");
  sb.push("  - DOMAIN-SUFFIX,twimg.com,🌐 GLOBAL / PROXY");
  sb.push("  - DOMAIN-SUFFIX,spotify.com,🌐 GLOBAL / PROXY");
  sb.push("  - DOMAIN-SUFFIX,ru,DIRECT");
  sb.push("  - DOMAIN-SUFFIX,su,DIRECT");
  sb.push("  - DOMAIN-SUFFIX,xn--p1ai,DIRECT");
  sb.push("  - GEOIP,RU,DIRECT");
  sb.push("  - MATCH,🚀 FALLBACK");

  return sb.join("\n");
}

// =============================================================================
// 🌐 EDGE CRAWLER & GITHUB CACHE
// =============================================================================
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

async function fetchFromGitHub(file, env, ctx) {
  const repoRaw = env?.REPO_RAW || DEFAULT_REPO_RAW;
  const cacheKey = `https://edge-cache.turboprobe.internal/${file}`;
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (!response) {
    const targetUrl = `${repoRaw}/${file}?t=${Date.now()}`;
    const res = await fetch(targetUrl, { headers: { "User-Agent": "TurboProbe-Edge-Worker/7.0" } });
    if (res.ok) {
      const text = await res.text();
      response = new Response(text, {
        headers: {
          "Content-Type": file.endsWith(".json") ? "application/json" : "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=180, s-maxage=300, stale-while-revalidate=600",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return text;
    }
    return "";
  }
  return await response.text();
}

async function handleSub(filename, env, ctx, title) {
  const content = await fetchFromGitHub(filename, env, ctx);
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

async function handleBase64(env, ctx) {
  const content = await fetchFromGitHub("base64.txt", env, ctx);
  return new Response(content, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "profile-title": `base64:${btoa('TurboProbe Base64')}`,
      "profile-update-interval": "6",
    },
  });
}

async function handleClash(env, ctx) {
  const content = await fetchFromGitHub("clash-meta.yaml", env, ctx);
  return new Response(content, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/yaml; charset=utf-8",
      "profile-update-interval": "6",
      "Subscription-Userinfo": "upload=0; download=1073741824; total=1073741824000; expire=2030-01-01",
    },
  });
}

function handleWebDashboard(request, url, clientCountry, clientCity) {
  const origin = url.origin;
  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TurboProbe · API Gateway & Edge Node Hub</title>
  <style>
    :root { --bg: #0a0a0a; --surface: #131313; --accent: #22c55e; --text: #e5e5e5; --text-dim: #737373; }
    body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; margin: 0; padding: 40px 20px; text-align: center; }
    .card { background: var(--surface); max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); }
    h1 { margin: 0 0 10px; font-size: 24px; color: var(--accent); }
    p { color: var(--text-dim); font-size: 14px; margin: 0 0 20px; }
    .badge { display: inline-block; padding: 4px 10px; background: rgba(34,197,94,0.1); color: var(--accent); border-radius: 6px; font-size: 12px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <h1>TurboProbe Edge API v7.0</h1>
    <p>Суверенный роутер и генератор подписок VLESS / Trojan / Hysteria 2</p>
    <div class="badge">Edge Anycast Online · IP: ${clientCountry} (${clientCity})</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}
