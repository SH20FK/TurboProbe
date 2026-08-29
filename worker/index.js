/**
 * ⚡ TurboProbe Dynamic Subscription Worker
 * Multi-service on-the-fly proxy aggregator & filter
 *
 * Supported URLs:
 * - https://turboprobe.workers.dev/sub
 * - https://turboprobe.workers.dev/sub?services=chatgpt,gemini
 * - https://turboprobe.workers.dev/sub?country=de&max_ping=80
 * - https://turboprobe.workers.dev/sub/chatgpt+gemini
 * - https://turboprobe.workers.dev/sub/ai
 * - https://turboprobe.workers.dev/sub/clash
 */

const JSON_MIRRORS = [
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/preview.json',
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/sub/preview.json',
  'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub/preview.json',
  'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/docs/sub/preview.json',
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/nodes.json',
];

const TEXT_MIRRORS = [
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/all.txt',
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt',
  'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub/top50.txt',
  'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/anti-whitelist.txt',
];

const COMMON_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Profile-Update-Interval': '6',
  'Subscription-Userinfo': 'upload=0; download=0; total=1073741824000; expire=0',
  'Cache-Control': 'public, max-age=300, s-maxage=300'
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'public, max-age=86400'
        },
      });
    }

    // 2. Health check endpoint (explicitly /health only)
    if (path === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          project: 'TurboProbe Dynamic Subscription Generator',
          usage: '/?services=chatgpt,gemini&country=de'
        }, null, 2),
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=300'
          }
        }
      );
    }

    // 3. Minimal monochrome landing page (editorial, dark, no gradients)
    if (path === '/' || path === '') {
      const landing = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TurboProbe Edge API</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&family=Geist+Mono:wght@400&display=swap');
:root{--bg:#0b0b0c;--fg:#eae9e6;--line:rgba(234,233,230,0.08);--mono:'Geist Mono',monospace;--serif:'Cormorant Garamond','Playfair Display',serif;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{height:100%;background:var(--bg);color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.45;letter-spacing:0.02em;}
main{max-width:480px;margin:0 auto;padding:160px 24px 60px;display:flex;flex-direction:column;align-items:center;gap:32px;text-align:center;}
h1{font-family:var(--serif);font-weight:300;font-size:clamp(2.2rem,8vw,3.6rem);letter-spacing:-0.04em;line-height:0.9;color:#fdfdfc;margin-bottom:6px;}
.subtitle{font-family:var(--mono);font-size:11px;color:#9a9790;text-transform:uppercase;letter-spacing:0.08em;}
.meta{font-family:var(--mono);font-size:11px;color:#5a5752;letter-spacing:0.06em;text-transform:uppercase;margin-top:48px;opacity:.7;}
svg{display:block;margin:0 auto 24px;opacity:.95;}
</style>
</head>
<body>
<main>
  <div>
    <svg width="44" height="30" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="TurboProbe logo">
      <polygon points="20,0 40,28 0,28" stroke="#eae9e6" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
      <circle cx="20" cy="19" r="2.2" fill="#eae9e6" opacity=".9"/>
    </svg>
    <h1>TurboProbe Edge API</h1>
    <div class="subtitle">Роутер и генератор подписок VLESS / Trojan / Hysteria 2</div>
  </div>
  <div style="font-family:var(--mono);font-size:12px;color:#787774;line-height:1.55;max-width:420px;">
    <p>Этот сайт обслуживает VPN агрегатор <strong>TurboProbe</strong>, создано <strong>SH20FK</strong> с любовью для сообщества.</p>
  </div>
  <div class="meta">TurboProbe Edge &middot; SH20FK &middot; 2026</div>
</main>
</body>
</html>`;
      return new Response(landing, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300, s-maxage=300'
        }
      });
    }

    try {
      // Multi-Service parsing (e.g. ?services=chatgpt,gemini)
      let services = [];

      // Multi-Country parsing (e.g. ?country=de,nl,kz)
      let countries = [];
      const countryParam = url.searchParams.get('country') || url.searchParams.get('cc');
      if (countryParam && countryParam !== 'all') {
        countries = countryParam.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      }

      // Multi-Protocol parsing (e.g. ?proto=reality,hy2)
      let protos = [];
      const protoParam = url.searchParams.get('proto') || url.searchParams.get('protocol');
      if (protoParam && protoParam !== 'all') {
        protos = protoParam.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
      }

      let maxPing = parseInt(url.searchParams.get('max_ping') || url.searchParams.get('ping') || '0', 10);
      let minHealth = parseInt(url.searchParams.get('min_health') || url.searchParams.get('health') || '0', 10);
      let limit = parseInt(url.searchParams.get('limit') || '100', 10);
      let format = (url.searchParams.get('format') || url.searchParams.get('type') || 'plain').toLowerCase();

      // Direct query parameters (e.g. ?services=chatgpt,gemini OR ?chatgpt,gemini)
      const servicesParam = url.searchParams.get('services') || url.searchParams.get('service') || url.searchParams.get('srv');
      if (servicesParam) {
        services = servicesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      } else {
        // Support shorthand ?chatgpt,gemini or ?de
        for (const [key, val] of url.searchParams.entries()) {
          if (val === '' && key) {
            if (['de', 'nl', 'kz', 'fi', 'tr', 'ru', 'se', 'us', 'sg', 'gb', 'fr', 'jp'].includes(key.toLowerCase())) {
              countries.push(key.toLowerCase());
            } else {
              services.push(key.toLowerCase());
            }
          }
        }
      }

      // RESTful path parsing (e.g. /ai, /chatgpt+gemini, /de, /sub/ai)
      const cleanPath = path.replace(/^\/sub\/?/, '/').replace(/^\//, '').trim();
      if (cleanPath) {
        if (cleanPath === 'ai' || cleanPath === 'ai-bundle') {
          services = ['chatgpt', 'claude', 'gemini'];
        } else if (cleanPath === 'youtube') {
          services = ['youtube', 'discord'];
        } else if (cleanPath === 'anti-tspu' || cleanPath === 'reality') {
          protos = ['reality'];
        } else if (cleanPath === 'clash' || cleanPath === 'meta') {
          format = 'clash';
        } else if (cleanPath === 'singbox' || cleanPath === 'sing-box') {
          format = 'singbox';
        } else if (cleanPath === 'base64' || cleanPath === 'b64') {
          format = 'base64';
        } else if (['de', 'nl', 'kz', 'fi', 'tr', 'ru', 'se', 'us', 'sg', 'gb', 'fr', 'jp'].includes(cleanPath)) {
          countries = [cleanPath];
        } else if (cleanPath.includes('+') || cleanPath.includes(',')) {
          services = cleanPath.split(/[+,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        } else {
          services = [cleanPath];
        }
      }

      // 4. Parallel fetch Cached preview.json / nodes.json with Promise.any and timeout fallbacks
      let allNodes = await fetchFirstSuccessfulJson(JSON_MIRRORS, 3500);

      // If all JSON mirrors fail, parallel fallback to raw text lists
      if (allNodes.length === 0) {
        const lines = await fetchFirstSuccessfulText(TEXT_MIRRORS, 3500);
        if (lines.length > 0) {
          const userAgent = (request.headers.get('User-Agent') || '').toLowerCase();
          const isClash = format === 'clash' || format === 'meta' || format === 'yaml' ||
                          path.includes('/clash') || path.includes('/meta') ||
                          userAgent.includes('clash') || userAgent.includes('mihomo') || userAgent.includes('flclash') || userAgent.includes('stash');
          
          if (isClash) {
            const clashYaml = generateClashMetaYaml(lines.map(u => ({ uri: u })));
            return new Response(clashYaml, {
              headers: {
                ...COMMON_HEADERS,
                'Content-Type': 'text/yaml; charset=utf-8',
                'Content-Disposition': 'inline; filename="TurboProbe_Clash.yaml"'
              }
            });
          }

          if (format === 'singbox' || format === 'sing-box' || path.includes('/singbox')) {
            const sbJson = generateSingboxJson(lines.map(u => ({ uri: u })));
            return new Response(JSON.stringify(sbJson, null, 2), {
              headers: {
                ...COMMON_HEADERS,
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': 'inline; filename="TurboProbe_Singbox.json"'
              }
            });
          }

          if (format === 'base64' || format === 'b64' || path.includes('/base64')) {
            const b64 = safeBase64Encode(lines.join('\n'));
            return new Response(b64, {
              headers: {
                ...COMMON_HEADERS,
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': 'inline; filename="TurboProbe_Base64.txt"'
              }
            });
          }

          return new Response(lines.join('\n'), {
            headers: {
              ...COMMON_HEADERS,
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': 'inline; filename="TurboProbe_Sub.txt"'
            }
          });
        }
        return new Response('No active nodes available.', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store'
          }
        });
      }

      // 5. Filter Nodes dynamically on edge
      let matching = allNodes.filter(node => {
        if (!node || !node.uri) return false;

        // Filter by services (multi-select match)
        if (services.length > 0) {
          if (!node.services) return false;
          const hasAny = services.some(s => Boolean(node.services[s]));
          if (!hasAny) return false;
        }

        // Filter by countries (multi-select match)
        if (countries.length > 0) {
          const nCountry = (node.country || '').toLowerCase().trim();
          const matchCountry = countries.some(c => {
            const target = c.toLowerCase().trim();
            if (nCountry === target) return true;
            if (node.uri && node.uri.includes('#')) {
              const tag = node.uri.split('#')[1].toLowerCase();
              return tag.includes(`[${target}]`) || tag.includes(`(${target})`) || tag.includes(`-${target}-`) || tag.includes(` ${target} `);
            }
            return false;
          });
          if (!matchCountry) return false;
        }

        // Filter by protocols (multi-select match)
        if (protos.length > 0) {
          const nProto = (node.protocol || '').toLowerCase();
          const nUri = (node.uri || '').toLowerCase();
          const matchProto = protos.some(p => {
            if (p === 'reality') return nUri.includes('pbk=') || nProto.includes('reality');
            if (p === 'hy2' || p === 'hysteria2') return nProto.includes('hy2') || nProto.includes('hysteria2') || nUri.startsWith('hy2://') || nUri.startsWith('hysteria2://');
            if (p === 'trojan') return nProto.includes('trojan') || nUri.startsWith('trojan://');
            if (p === 'ss' || p === 'shadowsocks') return nProto.includes('ss') || nProto.includes('shadowsocks') || nUri.startsWith('ss://');
            if (p === 'vless') return nProto.includes('vless') || nUri.startsWith('vless://');
            return nProto.includes(p) || nUri.startsWith(p);
          });
          if (!matchProto) return false;
        }

        // Filter by max ping
        if (maxPing > 0 && (node.ping_ms || 999) > maxPing) {
          return false;
        }

        // Filter by min health
        if (minHealth > 0 && (node.health ?? 100) < minHealth) {
          return false;
        }

        return true;
      });

      // If strict filter yielded empty, fallback to top 20 verified nodes
      if (matching.length === 0) {
        matching = allNodes.slice(0, 20);
      }

      // Cap to requested limit
      const finalNodes = matching.slice(0, limit);

      // Check format request
      const userAgent = (request.headers.get('User-Agent') || '').toLowerCase();
      const isClashClient = format === 'clash' || format === 'meta' || format === 'yaml' ||
                            path.includes('/clash') || path.includes('/meta') ||
                            userAgent.includes('clash') || userAgent.includes('mihomo') || userAgent.includes('flclash') || userAgent.includes('stash');

      if (isClashClient) {
        const clashYaml = generateClashMetaYaml(finalNodes);
        return new Response(clashYaml, {
          headers: {
            ...COMMON_HEADERS,
            'Content-Type': 'text/yaml; charset=utf-8',
            'Content-Disposition': 'inline; filename="TurboProbe_Clash.yaml"'
          }
        });
      }

      if (format === 'singbox' || format === 'sing-box' || path.includes('/singbox')) {
        const sbJson = generateSingboxJson(finalNodes);
        return new Response(JSON.stringify(sbJson, null, 2), {
          headers: {
            ...COMMON_HEADERS,
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': 'inline; filename="TurboProbe_Singbox.json"'
          }
        });
      }

      const lines = finalNodes.map(n => n.uri).filter(Boolean);
      const outputText = lines.join('\n');

      if (format === 'base64' || format === 'b64' || path.includes('/base64')) {
        const b64 = safeBase64Encode(outputText);
        return new Response(b64, {
          headers: {
            ...COMMON_HEADERS,
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': 'inline; filename="TurboProbe_Base64.txt"'
          }
        });
      }

      // Plain text URI list
      return new Response(outputText, {
        headers: {
          ...COMMON_HEADERS,
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'inline; filename="TurboProbe_Sub.txt"'
        }
      });

    } catch (err) {
      return new Response(`Worker Error: ${err.message}`, {
        status: 500,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store'
        }
      });
    }
  }
};

/**
 * Parallel upstream JSON mirror fetcher using Promise.any and abort timeouts.
 */
async function fetchFirstSuccessfulJson(mirrors, timeoutMs = 3500) {
  const promises = mirrors.map(async (mirrorUrl) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(mirrorUrl, {
        signal: controller ? controller.signal : undefined,
        headers: { 'User-Agent': 'TurboProbe-EdgeWorker/2.0' },
        cf: { cacheTtl: 60, cacheEverything: true }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.nodes) ? data.nodes : []);
      const validList = list.filter(n => n && typeof n.uri === 'string' && !n.uri.startsWith('<') && !n.uri.startsWith('=') && !n.uri.startsWith('>'));
      if (validList.length > 0) {
        return validList;
      }
      throw new Error('Empty or invalid nodes list');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  });

  try {
    return await Promise.any(promises);
  } catch (_) {
    return [];
  }
}

/**
 * Parallel upstream plaintext mirror fetcher using Promise.any and abort timeouts.
 */
async function fetchFirstSuccessfulText(mirrors, timeoutMs = 3500) {
  const promises = mirrors.map(async (mirrorUrl) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(mirrorUrl, {
        signal: controller ? controller.signal : undefined,
        headers: { 'User-Agent': 'TurboProbe-EdgeWorker/2.0' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines = text
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.startsWith('//') && !l.startsWith('<') && !l.startsWith('=') && !l.startsWith('>'));
      if (lines.length > 0) {
        return lines;
      }
      throw new Error('Empty text content');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  });

  try {
    return await Promise.any(promises);
  } catch (_) {
    return [];
  }
}

/**
 * Safe Base64 decode with URL-safe replacement and padding repair.
 */
function safeBase64Decode(str) {
  if (!str) return '';
  let clean = '';
  try {
    clean = decodeURIComponent(str);
  } catch (_) {
    clean = str;
  }
  clean = clean.replace(/-/g, '+').replace(/_/g, '/').trim();
  const pad = clean.length % 4;
  if (pad === 2) clean += '==';
  else if (pad === 3) clean += '=';
  else if (pad === 1) clean += '===';
  try {
    if (typeof atob === 'function') {
      return atob(clean);
    }
  } catch (_) {}
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(clean, 'base64').toString('utf-8');
    }
  } catch (_) {}
  return '';
}

/**
 * Safe Base64 encode for UTF-8 strings.
 */
function safeBase64Encode(str) {
  if (!str) return '';
  try {
    if (typeof btoa === 'function') {
      return btoa(unescape(encodeURIComponent(str)));
    }
  } catch (_) {}
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64');
    }
  } catch (_) {}
  return str;
}

/**
 * Robust Shadowsocks URI parser (handles SIP002 Base64 userinfo, plain userinfo, and Legacy Base64 formats).
 */
function parseShadowsocksUri(uri) {
  try {
    if (!uri || !uri.startsWith('ss://')) return null;
    let main = uri.slice(5);
    let tag = '';
    if (main.includes('#')) {
      const parts = main.split('#');
      main = parts[0];
      try {
        tag = decodeURIComponent(parts.slice(1).join('#')).trim();
      } catch (_) {
        tag = parts.slice(1).join('#').trim();
      }
    }
    if (main.includes('?')) {
      main = main.split('?')[0];
    }

    let method = 'aes-256-gcm';
    let password = '';
    let host = '';
    let port = 8388;

    const parseHostPort = (hp) => {
      let h = '', p = 8388;
      if (hp.startsWith('[')) {
        const closeBracket = hp.indexOf(']');
        if (closeBracket !== -1) {
          h = hp.slice(1, closeBracket);
          const rest = hp.slice(closeBracket + 1);
          if (rest.startsWith(':')) {
            p = parseInt(rest.slice(1), 10) || 8388;
          }
        } else {
          h = hp.replace(/^\[|\]$/g, '');
        }
      } else if (hp.includes(':')) {
        const lastColon = hp.lastIndexOf(':');
        h = hp.slice(0, lastColon).replace(/^\[|\]$/g, '');
        p = parseInt(hp.slice(lastColon + 1), 10) || 8388;
      } else {
        h = hp.replace(/^\[|\]$/g, '');
      }
      return { host: h, port: p };
    };

    if (main.includes('@')) {
      // SIP002 format: [base64_userinfo | user:pass]@host:port
      const atIdx = main.lastIndexOf('@');
      let rawUserInfo = main.slice(0, atIdx);
      const hostPort = main.slice(atIdx + 1);

      try {
        rawUserInfo = decodeURIComponent(rawUserInfo);
      } catch (_) {}

      if (rawUserInfo.includes(':')) {
        const colonIdx = rawUserInfo.indexOf(':');
        method = rawUserInfo.slice(0, colonIdx);
        password = rawUserInfo.slice(colonIdx + 1);
      } else {
        const decoded = safeBase64Decode(rawUserInfo);
        if (decoded.includes(':')) {
          const colonIdx = decoded.indexOf(':');
          method = decoded.slice(0, colonIdx);
          password = decoded.slice(colonIdx + 1);
        } else {
          password = decoded || rawUserInfo;
        }
      }
      const hp = parseHostPort(hostPort);
      host = hp.host;
      port = hp.port;
    } else {
      // Legacy format: base64(method:password@host:port)
      const decoded = safeBase64Decode(main);
      if (decoded.includes('@')) {
        const atIdx = decoded.lastIndexOf('@');
        const rawUserInfo = decoded.slice(0, atIdx);
        const hostPort = decoded.slice(atIdx + 1);

        if (rawUserInfo.includes(':')) {
          const colonIdx = rawUserInfo.indexOf(':');
          method = rawUserInfo.slice(0, colonIdx);
          password = rawUserInfo.slice(colonIdx + 1);
        }
        const hp = parseHostPort(hostPort);
        host = hp.host;
        port = hp.port;
      }
    }

    if (host && password && method) {
      const cleanMethod = method.trim().toLowerCase();
      if (VALID_SS_CIPHERS.has(cleanMethod)) {
        return { method: cleanMethod, password, host, port, tag };
      }
    }
  } catch (_) {}
  return null;
}

const VALID_SS_CIPHERS = new Set([
  'aes-128-gcm', 'aes-192-gcm', 'aes-256-gcm',
  'chacha20-ietf-poly1305', 'xchacha20-ietf-poly1305',
  '2022-blake3-aes-128-gcm', '2022-blake3-aes-256-gcm', '2022-blake3-chacha20-poly1305',
  'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
  'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb',
  'rc4-md5', 'chacha20-ietf', 'dummy', 'none'
]);

/**
 * Generates Clash Meta / Mihomo YAML subscription configuration.
 */
function generateClashMetaYaml(nodes) {
  const sanitizeStr = (s) => {
    if (s == null) return '';
    return s
      .toString()
      // Strip control characters (0x00-0x1F, 0x7F-0x9F, Unicode invisible/RTL/BOM chars)
      .replace(/[\x00-\x1f\x7f-\x9f\u2000-\u200f\u2028-\u202f\ufeff]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const escapeYaml = (s) => {
    const clean = sanitizeStr(s);
    return clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  };

  const proxies = [];
  const proxyNames = [];
  const seenNames = new Set();

  nodes.forEach((node, idx) => {
    try {
      let uri = typeof node === 'string' ? node : (node && node.uri);
      if (!uri) return;

      // Auto-correct mislabeled ss:// links that are actually VLESS Reality
      if (uri.startsWith('ss://') && (uri.includes('security=reality') || uri.includes('pbk=') || uri.includes('flow=xtls'))) {
        uri = 'vless://' + uri.slice(5);
      }

      let cleanName = `TurboProbe-${String(idx + 1).padStart(3, '0')}`;
      if (uri.includes('#')) {
        try {
          const rawTag = decodeURIComponent(uri.split('#')[1]).trim();
          if (rawTag) {
            cleanName = sanitizeStr(rawTag)
              .replace(/[:"'\[\]]/g, '')
              .slice(0, 40)
              .trim() || cleanName;
          }
        } catch (_) {}
      }
      let name = `${cleanName} #${idx + 1}`;
      if (seenNames.has(name)) name = `${name}-${idx + 1}`;
      seenNames.add(name);

      if (uri.startsWith('ss://')) {
        const ss = parseShadowsocksUri(uri);
        if (ss && ss.host && ss.password && ss.method && VALID_SS_CIPHERS.has(ss.method)) {
          const p = [
            `  - name: "${escapeYaml(name)}"`,
            `    type: ss`,
            `    server: "${escapeYaml(ss.host)}"`,
            `    port: ${ss.port}`,
            `    cipher: "${escapeYaml(ss.method)}"`,
            `    password: "${escapeYaml(ss.password)}"`,
            `    udp: true`
          ];
          proxies.push(p.join('\n'));
          proxyNames.push(name);
        }
        return;
      }

      const urlObj = new URL(uri);
      const proto = urlObj.protocol.replace(':', '').toLowerCase();
      const host = urlObj.hostname.replace(/^\[|\]$/g, '');
      const port = parseInt(urlObj.port || '443', 10);
      const user = decodeURIComponent(urlObj.username || urlObj.password || '');

      if (proto === 'vless') {
        const security = (urlObj.searchParams.get('security') || 'none').toLowerCase();
        const sni = urlObj.searchParams.get('sni') || host;
        const pbk = urlObj.searchParams.get('pbk') || '';
        const sid = (urlObj.searchParams.get('sid') || '').trim();
        const fp = urlObj.searchParams.get('fp') || 'chrome';
        const type = (urlObj.searchParams.get('type') || 'tcp').toLowerCase();
        const flow = urlObj.searchParams.get('flow') || '';

        const p = [
          `  - name: "${escapeYaml(name)}"`,
          `    type: vless`,
          `    server: "${escapeYaml(host)}"`,
          `    port: ${port}`,
          `    uuid: "${escapeYaml(user)}"`,
          `    udp: true`,
          `    tls: ${security === 'tls' || security === 'reality'}`,
          `    servername: "${escapeYaml(sni)}"`,
          `    client-fingerprint: "${escapeYaml(fp)}"`,
          `    network: ${type}`
        ];
        if (flow) {
          p.push(`    flow: ${flow}`);
        }
        if (security === 'reality' && pbk) {
          p.push('    reality-opts:');
          p.push(`      public-key: "${escapeYaml(pbk)}"`);
          if (sid && /^[0-9a-fA-F]{2,16}$/.test(sid) && sid.length % 2 === 0) {
            p.push(`      short-id: "${escapeYaml(sid)}"`);
          }
        }
        if (type === 'ws') {
          const wsPath = urlObj.searchParams.get('path') || '/';
          const wsHost = urlObj.searchParams.get('host') || sni;
          p.push('    ws-opts:');
          p.push(`      path: "${escapeYaml(wsPath)}"`);
          p.push('      headers:');
          p.push(`        Host: "${escapeYaml(wsHost)}"`);
        } else if (type === 'grpc') {
          const sName = urlObj.searchParams.get('serviceName') || '';
          p.push('    grpc-opts:');
          p.push(`      grpc-service-name: "${escapeYaml(sName)}"`);
        }
        proxies.push(p.join('\n'));
        proxyNames.push(name);
      } else if (proto === 'trojan') {
        const sni = urlObj.searchParams.get('sni') || host;
        const type = (urlObj.searchParams.get('type') || 'tcp').toLowerCase();
        const insecure = urlObj.searchParams.get('allowInsecure') === '1' || urlObj.searchParams.get('insecure') === '1' || urlObj.searchParams.get('insecure') === 'true';
        const p = [
          `  - name: "${escapeYaml(name)}"`,
          `    type: trojan`,
          `    server: "${escapeYaml(host)}"`,
          `    port: ${port}`,
          `    password: "${escapeYaml(user)}"`,
          `    udp: true`,
          `    sni: "${escapeYaml(sni)}"`,
          `    skip-cert-verify: ${insecure}`,
          `    network: ${type}`
        ];
        if (type === 'ws') {
          const wsPath = urlObj.searchParams.get('path') || '/';
          const wsHost = urlObj.searchParams.get('host') || sni;
          p.push('    ws-opts:');
          p.push(`      path: "${escapeYaml(wsPath)}"`);
          p.push('      headers:');
          p.push(`        Host: "${escapeYaml(wsHost)}"`);
        } else if (type === 'grpc') {
          const sName = urlObj.searchParams.get('serviceName') || '';
          p.push('    grpc-opts:');
          p.push(`      grpc-service-name: "${escapeYaml(sName)}"`);
        }
        proxies.push(p.join('\n'));
        proxyNames.push(name);
      } else if (proto === 'hy2' || proto === 'hysteria2') {
        const sni = urlObj.searchParams.get('sni') || host;
        const insecure = urlObj.searchParams.get('insecure') === '1' || urlObj.searchParams.get('insecure') === 'true' || urlObj.searchParams.get('allowInsecure') === '1';
        const ports = urlObj.searchParams.get('ports') || urlObj.searchParams.get('mport') || '';
        const obfs = urlObj.searchParams.get('obfs') || '';
        const obfsPassword = urlObj.searchParams.get('obfs-password') || urlObj.searchParams.get('obfs_password') || '';
        const pass = decodeURIComponent(urlObj.password || urlObj.username || user || '');

        const p = [
          `  - name: "${escapeYaml(name)}"`,
          `    type: hysteria2`,
          `    server: "${escapeYaml(host)}"`,
          `    port: ${port}`,
          `    password: "${escapeYaml(pass)}"`,
          `    sni: "${escapeYaml(sni)}"`,
          `    skip-cert-verify: ${insecure}`
        ];
        if (ports) {
          p.push(`    ports: ${ports}`);
        }
        if (obfs) {
          p.push(`    obfs: "${escapeYaml(obfs)}"`);
          if (obfsPassword) {
            p.push(`    obfs-password: "${escapeYaml(obfsPassword)}"`);
          }
        }
        proxies.push(p.join('\n'));
        proxyNames.push(name);
      }
    } catch (_) {}
  });

  if (proxies.length === 0) {
    return 'proxies:\n  - {name: "TurboProbe-Fallback", type: vless, server: "1.1.1.1", port: 443, uuid: "00000000-0000-0000-0000-000000000000", udp: true}\n';
  }

  const groupMembers = proxyNames.map(n => `      - "${escapeYaml(n)}"`).join('\n');

  return [
    'port: 7890',
    'socks-port: 7891',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'proxies:',
    proxies.join('\n'),
    '',
    'proxy-groups:',
    '  - name: "⚡ TURBOPROBE-AUTO"',
    '    type: url-test',
    '    url: http://cp.cloudflare.com/generate_204',
    '    interval: 300',
    '    tolerance: 50',
    '    proxies:',
    groupMembers,
    '  - name: "🚀 SELECT"',
    '    type: select',
    '    proxies:',
    '      - "⚡ TURBOPROBE-AUTO"',
    groupMembers,
    '',
    'rules:',
    '  - DOMAIN-SUFFIX,openai.com,⚡ TURBOPROBE-AUTO',
    '  - DOMAIN-SUFFIX,claude.ai,⚡ TURBOPROBE-AUTO',
    '  - DOMAIN-SUFFIX,youtube.com,⚡ TURBOPROBE-AUTO',
    '  - DOMAIN-SUFFIX,discord.com,⚡ TURBOPROBE-AUTO',
    '  - DOMAIN-SUFFIX,instagram.com,⚡ TURBOPROBE-AUTO',
    '  - DOMAIN-SUFFIX,x.com,⚡ TURBOPROBE-AUTO',
    '  - DOMAIN-SUFFIX,twitter.com,⚡ TURBOPROBE-AUTO',
    '  - GEOIP,RU,DIRECT',
    '  - MATCH,⚡ TURBOPROBE-AUTO'
  ].join('\n');
}

/**
 * Generates Sing-box Outbound JSON configuration.
 */
function generateSingboxJson(nodes) {
  const outbounds = [];
  const tags = [];

  nodes.forEach((node, idx) => {
    try {
      const uri = typeof node === 'string' ? node : (node && node.uri);
      if (!uri) return;

      let cleanName = `TurboProbe-${String(idx + 1).padStart(3, '0')}`;
      if (uri.includes('#')) {
        try {
          const rawTag = decodeURIComponent(uri.split('#')[1]).trim();
          if (rawTag) cleanName = rawTag.replace(/[:"'\[\]]/g, '').trim().slice(0, 40);
        } catch (_) {}
      }
      const tag = `${cleanName} #${idx + 1}`;

      if (uri.startsWith('ss://')) {
        const ss = parseShadowsocksUri(uri);
        if (ss && ss.host && ss.password) {
          outbounds.push({
            type: 'shadowsocks',
            tag,
            server: ss.host,
            server_port: ss.port,
            method: ss.method,
            password: ss.password
          });
          tags.push(tag);
        }
        return;
      }

      const urlObj = new URL(uri);
      const proto = urlObj.protocol.replace(':', '').toLowerCase();
      const host = urlObj.hostname.replace(/^\[|\]$/g, '');
      const port = parseInt(urlObj.port || '443', 10);
      const user = decodeURIComponent(urlObj.username || urlObj.password || '');

      if (proto === 'vless') {
        const security = (urlObj.searchParams.get('security') || 'none').toLowerCase();
        const sni = urlObj.searchParams.get('sni') || host;
        const pbk = urlObj.searchParams.get('pbk') || '';
        const sid = urlObj.searchParams.get('sid') || '';
        const fp = urlObj.searchParams.get('fp') || 'chrome';
        const flow = urlObj.searchParams.get('flow') || '';

        const ob = {
          type: 'vless',
          tag,
          server: host,
          server_port: port,
          uuid: user,
          packet_encoding: 'xudp'
        };
        if (flow) ob.flow = flow;
        if (security === 'tls' || security === 'reality') {
          ob.tls = {
            enabled: true,
            server_name: sni,
            utls: { enabled: true, fingerprint: fp }
          };
          if (security === 'reality' && pbk) {
            ob.tls.reality = { enabled: true, public_key: pbk, short_id: sid };
          }
        }
        outbounds.push(ob);
        tags.push(tag);
      } else if (proto === 'trojan') {
        const sni = urlObj.searchParams.get('sni') || host;
        outbounds.push({
          type: 'trojan',
          tag,
          server: host,
          server_port: port,
          password: user,
          tls: { enabled: true, server_name: sni }
        });
        tags.push(tag);
      } else if (proto === 'hy2' || proto === 'hysteria2') {
        const sni = urlObj.searchParams.get('sni') || host;
        const insecure = urlObj.searchParams.get('insecure') === '1' || urlObj.searchParams.get('insecure') === 'true' || urlObj.searchParams.get('allowInsecure') === '1';
        const pass = decodeURIComponent(urlObj.password || urlObj.username || user || '');
        const obfs = urlObj.searchParams.get('obfs') || '';
        const obfsPassword = urlObj.searchParams.get('obfs-password') || urlObj.searchParams.get('obfs_password') || '';

        const ob = {
          type: 'hysteria2',
          tag,
          server: host,
          server_port: port,
          password: pass,
          tls: { enabled: true, server_name: sni, insecure }
        };
        if (obfs && obfsPassword) {
          ob.obfs = { type: obfs, password: obfsPassword };
        }
        outbounds.push(ob);
        tags.push(tag);
      }
    } catch (_) {}
  });

  if (outbounds.length === 0) {
    outbounds.push({
      type: 'vless',
      tag: 'TurboProbe-Fallback',
      server: '1.1.1.1',
      server_port: 443,
      uuid: '00000000-0000-0000-0000-000000000000'
    });
    tags.push('TurboProbe-Fallback');
  }

  return {
    outbounds: [
      {
        type: 'selector',
        tag: 'select',
        outbounds: ['auto', ...tags],
        default: 'auto'
      },
      {
        type: 'urltest',
        tag: 'auto',
        outbounds: tags,
        url: 'http://cp.cloudflare.com/generate_204',
        interval: '3m',
        tolerance: 50
      },
      ...outbounds,
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' }
    ]
  };
}
