/**
 * ⚡ TurboProbe Stress Test Harness: Cloudflare Edge Worker Upstream Resilience
 * Simulates upstream HTTP 500 errors, timeouts, malformed JSON, text fallback racing,
 * catastrophic outages, and format auto-detection under stress.
 */

import workerHandler from '../worker/index.js';

// Helper mock fetch generator
function createMockFetch(routeHandlers) {
  return async function mockFetch(url, options = {}) {
    const urlStr = typeof url === 'string' ? url : (url.url || '');
    const signal = options.signal;

    // Check if signal already aborted
    if (signal && signal.aborted) {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    }

    // Find matched handler
    let handler = null;
    for (const [pattern, h] of Object.entries(routeHandlers)) {
      if (urlStr.includes(pattern)) {
        handler = h;
        break;
      }
    }

    if (!handler) {
      return new Response('Not Found', { status: 404 });
    }

    // Execute handler
    return new Promise((resolve, reject) => {
      let tid = null;

      if (signal) {
        signal.addEventListener('abort', () => {
          if (tid) clearTimeout(tid);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }

      const delay = handler.delayMs || 0;
      tid = setTimeout(() => {
        if (signal && signal.aborted) {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          return reject(err);
        }

        if (handler.error) {
          return reject(new Error(handler.error));
        }

        if (handler.status && handler.status !== 200) {
          return resolve(new Response(handler.body || 'Error', {
            status: handler.status,
            headers: handler.headers || { 'Content-Type': 'text/plain' }
          }));
        }

        resolve(new Response(handler.body, {
          status: 200,
          headers: handler.headers || { 'Content-Type': 'application/json' }
        }));
      }, delay);
    });
  };
}

const SAMPLE_NODES_JSON = JSON.stringify({
  nodes: [
    {
      id: 'node-1',
      uri: 'vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&sni=microsoft.com&pbk=ABCD1234EFGH5678&sid=1234#DE-Node-1',
      country: 'DE',
      ping_ms: 35,
      health: 95,
      services: { youtube: true, chatgpt: true }
    },
    {
      id: 'node-2',
      uri: 'trojan://TrojanSecret@198.51.100.2:443?sni=trojan.example.com#NL-Node-2',
      country: 'NL',
      ping_ms: 42,
      health: 90,
      services: { youtube: true, discord: true }
    },
    {
      id: 'node-3',
      uri: 'hy2://Hy2Pass@198.51.100.3:443?sni=hy2.example.com#US-Hy2-3',
      country: 'US',
      ping_ms: 110,
      health: 85,
      services: { chatgpt: true, gemini: true }
    }
  ]
});

const SAMPLE_TEXT_FEED = [
  '# TurboProbe Proxies Feed',
  '<<<<<<< HEAD',
  'vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&sni=microsoft.com&pbk=ABCD1234EFGH5678&sid=1234#Fallback-VLESS',
  '=======',
  'trojan://TrojanSecret@198.51.100.2:443?sni=trojan.example.com#Fallback-Trojan',
  '>>>>>>> main',
  'hy2://Hy2Pass@198.51.100.3:443?sni=hy2.example.com#Fallback-Hy2',
  'ss://YWVzLTI1Ni1nY206cGFzczEyMw@198.51.100.4:8388#Fallback-SS'
].join('\n');

async function runWorkerResilienceTests() {
  console.log('='.repeat(80));
  console.log('⚡ STRESS HARNESS 2: Cloudflare Edge Worker Upstream Resilience');
  console.log('='.repeat(80));

  const originalFetch = globalThis.fetch;
  const testResults = [];

  function record(testName, passed, details = '') {
    testResults.push({ testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] ${testName}${details ? ` -> ${details}` : ''}`);
    if (!passed) {
      throw new Error(`Test failed: ${testName} - ${details}`);
    }
  }

  try {
    // --------------------------------------------------------------------------
    // Test 1: Normal Upstream Operation (All Mirrors Healthy)
    // --------------------------------------------------------------------------
    {
      globalThis.fetch = createMockFetch({
        'preview.json': { body: SAMPLE_NODES_JSON, delayMs: 10 },
        'nodes.json': { body: SAMPLE_NODES_JSON, delayMs: 20 },
      });

      const req = new Request('https://turboprobe.workers.dev/sub?country=de&format=clash');
      const res = await workerHandler.fetch(req, {}, {});
      const text = await res.text();

      const is200 = res.status === 200;
      const hasClashHeader = res.headers.get('Content-Type')?.includes('text/yaml');
      const hasDeNode = text.includes('DE-Node-1');
      const hasUserinfo = Boolean(res.headers.get('Subscription-Userinfo'));

      record('Normal Operation: JSON Mirrors 200 OK + Clash Format', is200 && hasClashHeader && hasDeNode && hasUserinfo, `Status: ${res.status}, Len: ${text.length}`);
    }

    // --------------------------------------------------------------------------
    // Test 2: HTTP 500 on All JSON Mirrors -> Seamless Text Mirror Fallback
    // --------------------------------------------------------------------------
    {
      globalThis.fetch = createMockFetch({
        'preview.json': { status: 500, body: 'Internal Server Error' },
        'nodes.json': { status: 502, body: 'Bad Gateway' },
        'all.txt': { status: 500, body: 'Internal Server Error' },
        'top50.txt': { status: 200, body: SAMPLE_TEXT_FEED, headers: { 'Content-Type': 'text/plain' }, delayMs: 15 },
        'anti-whitelist.txt': { status: 500, body: 'Error' }
      });

      const req = new Request('https://turboprobe.workers.dev/sub');
      const res = await workerHandler.fetch(req, {}, {});
      const text = await res.text();

      const is200 = res.status === 200;
      const lines = text.split('\n').filter(Boolean);
      const noConflictMarkers = !text.includes('<<<<<<<') && !text.includes('=======');
      const hasExtractedNodes = lines.length >= 3;

      record('Upstream HTTP 500 on JSON: Seamless Fallback to top50.txt', is200 && noConflictMarkers && hasExtractedNodes, `Extracted ${lines.length} nodes from text fallback without conflict markers`);
    }

    // --------------------------------------------------------------------------
    // Test 3: Upstream Timeout / Slow Mirror Racing (Promise.any)
    // --------------------------------------------------------------------------
    {
      // Mirror 1 hangs for 10 seconds, Mirror 2 returns in 30ms
      globalThis.fetch = createMockFetch({
        'raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/preview.json': { delayMs: 10000, body: SAMPLE_NODES_JSON },
        'cdn.jsdelivr.net/gh/SH20FK/TurboProbe@main/sub/preview.json': { delayMs: 30, body: SAMPLE_NODES_JSON }
      });

      const t0 = performance.now();
      const req = new Request('https://turboprobe.workers.dev/sub?services=youtube');
      const res = await workerHandler.fetch(req, {}, {});
      const t1 = performance.now();
      const durationMs = t1 - t0;
      const text = await res.text();

      const fastRace = durationMs < 500;
      const is200 = res.status === 200;

      record('Upstream Latency Racing: Promise.any beats slow hung mirror', is200 && fastRace, `Resolved in ${durationMs.toFixed(1)} ms (< 500ms target)`);
    }

    // --------------------------------------------------------------------------
    // Test 4: Upstream Corrupted / Malformed JSON on All Mirrors
    // --------------------------------------------------------------------------
    {
      globalThis.fetch = createMockFetch({
        'preview.json': { status: 200, body: '<html><head><title>502 Bad Gateway</title></head><body><h1>Bad Gateway</h1></body></html>', headers: { 'Content-Type': 'text/html' } },
        'nodes.json': { status: 200, body: '{"nodes": [ INVALID_JSON ... truncated', headers: { 'Content-Type': 'application/json' } },
        'all.txt': { status: 200, body: SAMPLE_TEXT_FEED, headers: { 'Content-Type': 'text/plain' } }
      });

      const req = new Request('https://turboprobe.workers.dev/sub?format=clash');
      const res = await workerHandler.fetch(req, {}, {});
      const text = await res.text();

      const is200 = res.status === 200;
      const hasClashProxies = text.includes('proxies:') && text.includes('Fallback-VLESS');

      record('Corrupted JSON Handling: Resilient fallback to text feed -> Clash YAML', is200 && hasClashProxies, `Successfully parsed proxies under HTML/truncated JSON responses`);
    }

    // --------------------------------------------------------------------------
    // Test 5: Catastrophic Outage (All JSON & Text Upstreams Fail / Network Down)
    // --------------------------------------------------------------------------
    {
      globalThis.fetch = createMockFetch({
        'preview.json': { status: 503, body: 'Service Unavailable' },
        'nodes.json': { status: 503, body: 'Service Unavailable' },
        'all.txt': { error: 'ECONNREFUSED connection failed' },
        'top50.txt': { error: 'ETIMEDOUT mirror unreachable' },
        'anti-whitelist.txt': { status: 500, body: 'Server Error' }
      });

      const req = new Request('https://turboprobe.workers.dev/sub');
      const res = await workerHandler.fetch(req, {}, {});
      const text = await res.text();

      const is503 = res.status === 503;
      const hasCleanMsg = text.includes('No active nodes available');
      const hasNoCache = res.headers.get('Cache-Control')?.includes('no-cache');

      record('Catastrophic Outage: Clean HTTP 503 with no-cache headers without crashing', is503 && hasCleanMsg && hasNoCache, `Response: "${text.trim()}", HTTP ${res.status}`);
    }

    // --------------------------------------------------------------------------
    // Test 6: User-Agent Auto-Detection & Format Switching on Fallback
    // --------------------------------------------------------------------------
    {
      globalThis.fetch = createMockFetch({
        'preview.json': { status: 500, body: 'Fail' },
        'nodes.json': { status: 500, body: 'Fail' },
        'all.txt': { status: 200, body: SAMPLE_TEXT_FEED, headers: { 'Content-Type': 'text/plain' } }
      });

      // 6a: Clash UA
      const clashReq = new Request('https://turboprobe.workers.dev/sub', {
        headers: { 'User-Agent': 'ClashMeta/v1.18.0' }
      });
      const clashRes = await workerHandler.fetch(clashReq, {}, {});
      const clashText = await clashRes.text();
      const isClashOk = clashRes.status === 200 && clashText.includes('proxies:') && clashText.includes('type: vless');

      // 6b: Singbox format
      const sbReq = new Request('https://turboprobe.workers.dev/sub?type=singbox');
      const sbRes = await workerHandler.fetch(sbReq, {}, {});
      const sbJson = await sbRes.json();
      const isSbOk = sbRes.status === 200 && Array.isArray(sbJson.outbounds) && sbJson.outbounds.length > 0;

      // 6c: Base64 format
      const b64Req = new Request('https://turboprobe.workers.dev/sub/base64');
      const b64Res = await workerHandler.fetch(b64Req, {}, {});
      const b64Text = await b64Res.text();
      const decoded = Buffer.from(b64Text.trim(), 'base64').toString('utf-8');
      const isB64Ok = b64Res.status === 200 && decoded.includes('vless://') && decoded.includes('trojan://');

      record('Format Auto-Detection (Clash UA, Singbox JSON, Base64) on Text Fallback', isClashOk && isSbOk && isB64Ok, 'All 3 format conversions succeeded seamlessly from raw text');
    }

    // --------------------------------------------------------------------------
    // Test 7: CORS Preflight and Options Request
    // --------------------------------------------------------------------------
    {
      const corsReq = new Request('https://turboprobe.workers.dev/sub', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://turboprobe.pages.dev',
          'Access-Control-Request-Method': 'GET'
        }
      });
      const corsRes = await workerHandler.fetch(corsReq, {}, {});
      const isCorsOk = corsRes.headers.get('Access-Control-Allow-Origin') === '*' &&
                       corsRes.headers.get('Access-Control-Allow-Methods')?.includes('GET');

      record('CORS Preflight (OPTIONS request)', isCorsOk, 'Valid CORS response with wildcard origin');
    }

    // --------------------------------------------------------------------------
    // Test 8: Health Check Endpoint
    // --------------------------------------------------------------------------
    {
      const healthReq = new Request('https://turboprobe.workers.dev/health');
      const healthRes = await workerHandler.fetch(healthReq, {}, {});
      const healthJson = await healthRes.json();
      const isHealthOk = healthRes.status === 200 && healthJson.status === 'ok';

      record('Health Check (/health)', isHealthOk, `Status: ${healthJson.status}`);
    }

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ All ${testResults.length} Edge Worker Upstream Resilience Tests PASSED!`);
  console.log('='.repeat(80));
  return testResults;
}

runWorkerResilienceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Worker Resilience Tests FAILED:', err);
    process.exit(1);
  });
