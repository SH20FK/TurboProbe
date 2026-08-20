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

    // 2. Health check / Root endpoint
    if (path === '/' || path === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          project: 'TurboProbe Dynamic Subscription Generator',
          usage: '/sub?services=chatgpt,gemini&country=de',
          endpoints: [
            '/sub',
            '/sub/ai',
            '/sub/youtube',
            '/sub/anti-tspu',
            '/sub/chatgpt+gemini',
            '/sub/de',
            '/sub/nl',
            '/sub/clash'
          ]
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
      // 3. Extract Filters from Query and Path
      let services = [];
      let country = (url.searchParams.get('country') || url.searchParams.get('cc') || 'all').toLowerCase();
      let proto = (url.searchParams.get('proto') || 'all').toLowerCase();
      let maxPing = parseInt(url.searchParams.get('max_ping') || url.searchParams.get('ping') || '0', 10);
      let minHealth = parseInt(url.searchParams.get('min_health') || url.searchParams.get('health') || '0', 10);
      let limit = parseInt(url.searchParams.get('limit') || '50', 10);
      let format = (url.searchParams.get('format') || 'plain').toLowerCase();

      // Query param services
      const servicesParam = url.searchParams.get('services') || url.searchParams.get('service') || url.searchParams.get('srv');
      if (servicesParam) {
        services = servicesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      }

      // RESTful path parsing (e.g. /sub/ai, /sub/chatgpt+gemini, /sub/de)
      if (path.startsWith('/sub/')) {
        const subPath = path.replace('/sub/', '').trim();
        if (subPath === 'ai' || subPath === 'ai-bundle') {
          services = ['chatgpt', 'claude', 'gemini'];
        } else if (subPath === 'youtube') {
          services = ['youtube', 'discord'];
        } else if (subPath === 'anti-tspu' || subPath === 'reality') {
          proto = 'reality';
        } else if (subPath === 'clash' || subPath === 'meta') {
          format = 'clash';
        } else if (['de', 'nl', 'kz', 'fi', 'tr', 'ru', 'se', 'us', 'sg'].includes(subPath)) {
          country = subPath;
        } else if (subPath.includes('+') || subPath.includes(',')) {
          services = subPath.split(/[+,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        } else if (subPath) {
          services = [subPath];
        }
      }

      // 4. Fetch Cached preview.json from GitHub
      const cacheKey = new Request(GITHUB_PREVIEW_URL);
      const cache = caches.default;
      let resp = await cache.match(cacheKey);

      if (!resp) {
        resp = await fetch(GITHUB_PREVIEW_URL, {
          headers: { 'User-Agent': 'TurboProbe-EdgeWorker/1.0' },
          cf: { cacheTtl: 60, cacheEverything: true }
        });
        if (resp.ok) {
          ctx.waitUntil(cache.put(cacheKey, resp.clone()));
        }
      }

      if (!resp.ok) {
        // Fallback to static raw file if preview.json is unreachable
        const fallback = await fetch(GITHUB_FALLBACK_SUB);
        return new Response(await fallback.text(), {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Profile-Update-Interval': '6'
          }
        });
      }

      const allNodes = await resp.json();
      if (!Array.isArray(allNodes) || allNodes.length === 0) {
        return new Response('No active nodes available.', { status: 503 });
      }

      // 5. Filter Nodes dynamically on edge
      let matching = allNodes.filter(node => {
        // Filter by services
        if (services.length > 0) {
          if (!node.services) return false;
          // Match if node supports ANY of the selected services
          const hasAny = services.some(s => Boolean(node.services[s]));
          if (!hasAny) return false;
        }

        // Filter by country
        if (country !== 'all') {
          const nCountry = (node.country || '').toLowerCase();
          const nUri = (node.uri || '').toLowerCase();
          if (!nCountry.includes(country) && !nUri.includes(country)) return false;
        }

        // Filter by protocol
        if (proto !== 'all') {
          const nProto = (node.protocol || '').toLowerCase();
          const nUri = (node.uri || '').toLowerCase();
          if (!nProto.includes(proto) && !nUri.startsWith(proto)) return false;
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
