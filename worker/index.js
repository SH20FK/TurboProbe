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

const GITHUB_PREVIEW_URL = 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/sub/preview.json';
const GITHUB_FALLBACK_SUB = 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt';

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
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
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
      const protoParam = url.searchParams.get('proto');
      if (protoParam && protoParam !== 'all') {
        protos = protoParam.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
      }

      let maxPing = parseInt(url.searchParams.get('max_ping') || url.searchParams.get('ping') || '0', 10);
      let minHealth = parseInt(url.searchParams.get('min_health') || url.searchParams.get('health') || '0', 10);
      let limit = parseInt(url.searchParams.get('limit') || '100', 10);
      let format = (url.searchParams.get('format') || 'plain').toLowerCase();

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
        } else if (['de', 'nl', 'kz', 'fi', 'tr', 'ru', 'se', 'us', 'sg'].includes(cleanPath)) {
          countries = [cleanPath];
        } else if (cleanPath.includes('+') || cleanPath.includes(',')) {
          services = cleanPath.split(/[+,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        } else {
          services = [cleanPath];
        }
      }

      // 4. Fetch Cached preview.json / nodes.json with multiple fallback mirrors
      const mirrors = [
        'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/preview.json',
        'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/docs/sub/preview.json',
        'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub/preview.json',
        'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/docs/sub/preview.json',
      ];

      let allNodes = [];
      for (const mirror of mirrors) {
        try {
          const res = await fetch(mirror, {
            headers: { 'User-Agent': 'TurboProbe-EdgeWorker/2.0' },
            cf: { cacheTtl: 60, cacheEverything: true }
          });
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.nodes || []);
            if (Array.isArray(list) && list.length > 0) {
              allNodes = list;
              break;
            }
          }
        } catch (_) {}
      }

      // If all JSON mirrors fail, fallback to raw top50.txt / anti-whitelist.txt
      if (allNodes.length === 0) {
        const textMirrors = [
          'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/top50.txt',
          'https://cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub/top50.txt',
          'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/anti-whitelist.txt',
        ];
        for (const tUrl of textMirrors) {
          try {
            const res = await fetch(tUrl, { headers: { 'User-Agent': 'TurboProbe-EdgeWorker/2.0' } });
            if (res.ok) {
              const text = await res.text();
              const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
              if (lines.length > 0) {
                return new Response(lines.join('\n'), {
                  headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Content-Disposition': 'inline; filename="TurboProbe_Sub.txt"',
                    'Access-Control-Allow-Origin': '*',
                    'Profile-Update-Interval': '6',
                  }
                });
              }
            }
          } catch (_) {}
        }
        return new Response('No active nodes available.', { status: 503 });
      }

      // 5. Filter Nodes dynamically on edge
      let matching = allNodes.filter(node => {
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

      // Check if Clash YAML format is requested (by param, path, or client User-Agent)
      const userAgent = (request.headers.get('User-Agent') || '').toLowerCase();
      const isClashClient = format === 'clash' || format === 'meta' || format === 'yaml' ||
                            path.includes('/clash') || path.includes('/meta') ||
                            userAgent.includes('clash') || userAgent.includes('mihomo') || userAgent.includes('flclash');

      if (isClashClient) {
        const clashYaml = generateClashMetaYaml(finalNodes);
        return new Response(clashYaml, {
          headers: {
            'Content-Type': 'text/yaml; charset=utf-8',
            'Content-Disposition': 'inline; filename="TurboProbe_Clash.yaml"',
            'Access-Control-Allow-Origin': '*',
            'Profile-Update-Interval': '6',
            'Subscription-Userinfo': 'upload=0; download=0; total=1073741824000; expire=0'
          }
        });
      }

      // Plain/Base64 URI List
      const lines = finalNodes.map(n => n.uri).filter(Boolean);
      const outputText = lines.join('\n');

      return new Response(outputText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'inline; filename="TurboProbe_Sub.txt"',
          'Access-Control-Allow-Origin': '*',
          'Profile-Update-Interval': '6',
          'Subscription-Userinfo': 'upload=0; download=0; total=1073741824000; expire=0'
        }
      });

    } catch (err) {
      return new Response(`Worker Error: ${err.message}`, { status: 500 });
    }
  }
};

function generateClashMetaYaml(nodes) {
  const proxies = [];
  const proxyNames = [];
  const seenNames = new Set();

  nodes.forEach((node, idx) => {
    try {
      const uri = node.uri;
      if (!uri) return;
      const urlObj = new URL(uri);
      const proto = urlObj.protocol.replace(':', '').toLowerCase();

      let cleanName = `TurboProbe-${String(idx + 1).padStart(3, '0')}`;
      if (uri.includes('#')) {
        try {
          const rawTag = decodeURIComponent(uri.split('#')[1]).trim();
          if (rawTag) cleanName = rawTag.replace(/[:"'\[\]]/g, '').trim().slice(0, 40);
        } catch (_) {}
      }
      let name = `${cleanName} #${idx + 1}`;
      if (seenNames.has(name)) name = `${name}-${idx + 1}`;
      seenNames.add(name);

      const host = urlObj.hostname;
      const port = parseInt(urlObj.port || '443', 10);
      const user = urlObj.username;

      if (proto === 'vless') {
        const security = urlObj.searchParams.get('security') || 'none';
        const sni = urlObj.searchParams.get('sni') || host;
        const pbk = urlObj.searchParams.get('pbk') || '';
        const sid = urlObj.searchParams.get('sid') || '';
        const fp = urlObj.searchParams.get('fp') || 'chrome';
        const type = urlObj.searchParams.get('type') || 'tcp';

        const p = [
          `  - name: "${name}"`,
          `    type: vless`,
          `    server: ${host}`,
          `    port: ${port}`,
          `    uuid: ${user}`,
          `    udp: true`,
          `    tls: ${security === 'tls' || security === 'reality'}`,
          `    servername: ${sni}`,
          `    client-fingerprint: ${fp}`,
          `    network: ${type}`
        ];
        if (security === 'reality' && pbk) {
          p.push('    reality-opts:');
          p.push(`      public-key: ${pbk}`);
          if (sid) p.push(`      short-id: ${sid}`);
        }
        proxies.push(p.join('\n'));
        proxyNames.push(name);
      } else if (proto === 'trojan') {
        const sni = urlObj.searchParams.get('sni') || host;
        const p = [
          `  - name: "${name}"`,
          `    type: trojan`,
          `    server: ${host}`,
          `    port: ${port}`,
          `    password: ${user}`,
          `    udp: true`,
          `    sni: ${sni}`
        ];
        proxies.push(p.join('\n'));
        proxyNames.push(name);
      }
    } catch (_) {}
  });

  if (proxies.length === 0) {
    return 'proxies:\n  - {name: "TurboProbe-Fallback", type: vless, server: 1.1.1.1, port: 443, uuid: 00000000-0000-0000-0000-000000000000, udp: true}\n';
  }

  const groupMembers = proxyNames.map(n => `      - "${n}"`).join('\n');

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
