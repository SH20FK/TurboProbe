// Dedicated network-specific subscription. Never falls back to the global pool.
export const VANTAGE = 'ru-chelyabinsk-intersvyaz';
export const POLICY = 'tunnel-https-v1';
export const MAX_AGE_MS = 3600_000;
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'text/plain; charset=utf-8',
  'Profile-Update-Interval': '1',
};

export function fresh(timestamp, now = Date.now()) {
  const time = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN;
  return Number.isFinite(time) && time <= now && now - time <= MAX_AGE_MS;
}

export async function selectRuNodes(data, now = Date.now()) {
  if (!data || data.schema_version !== 2 || data.verification_policy !== POLICY ||
      data.vantage?.id !== VANTAGE || data.vantage?.network !== 'Intersvyaz' ||
      !fresh(data.updated_at, now) || !Array.isArray(data.nodes)) return [];
  const selected = new Map();
  for (const node of data.nodes) {
    if (!node || node.verified !== true || node.ru_verified !== true ||
        node.verification_policy !== POLICY || node.vantage_id !== VANTAGE ||
        !fresh(node.checked_at, now) || !Number.isFinite(node.ping_ms) || node.ping_ms <= 0 ||
        typeof node.uri !== 'string' || !/^(vless|vmess|trojan|ss|hy2|hysteria2|tuic):\/\/\S+$/i.test(node.uri.split('#', 1)[0]) || /[\r\n]/.test(node.uri)) continue;
    const expires = Date.parse(node.expires_at);
    const checked = Date.parse(node.checked_at);
    if (!Number.isFinite(expires) || expires <= now || expires > checked + MAX_AGE_MS) continue;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(node.uri.trim().split('#', 1)[0]));
    const id = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
    if (id !== node.id) continue;
    selected.set(id, node);
  }
  return [...selected.values()].sort((a, b) => a.ping_ms - b.ping_ms);
}

export async function handleRu(request, fetcher = fetch, now = Date.now()) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, {headers: {...HEADERS, 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'}});
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: HEADERS});
  const format = url.searchParams.get('format') || 'plain';
  // Reject unsupported filters instead of silently ignoring them.
  if ([...url.searchParams.keys()].some(k => !['format', 'limit'].includes(k)) ||
      !['plain', 'base64', 'json'].includes(format)) return new Response('Supported: format=plain|base64|json and limit', {status: 400, headers: HEADERS});
  const limit = Number(url.searchParams.get('limit') || '5000');
  if (!Number.isInteger(limit) || limit < 1 || limit > 5000) return new Response('Invalid limit', {status: 400, headers: HEADERS});
  try {
    const upstream = 'https://raw.githubusercontent.com/SH20FK/TurboProbe/main/sub/ru-verified.json';
    const response = await fetcher(upstream + '?t=' + now, {signal: AbortSignal.timeout(6000), cache: 'no-store'});
    if (!response.ok) throw new Error('RU source unavailable');
    const data = await response.json();
    const nodes = (await selectRuNodes(data, now)).slice(0, limit);
    if (!nodes.length) return new Response('No fresh verified nodes for Chelyabinsk / Intersvyaz. No global fallback.', {status: 503, headers: HEADERS});
    let body = nodes.map(n => n.uri).join('\n');
    let contentType = HEADERS['Content-Type'];
    if (format === 'base64') {
      const bytes = new TextEncoder().encode(body);
      body = btoa(Array.from(bytes, x => String.fromCharCode(x)).join(''));
    } else if (format === 'json') {
      body = JSON.stringify({...data, nodes});
      contentType = 'application/json; charset=utf-8';
    }
    return new Response(request.method === 'HEAD' ? null : body, {headers: {...HEADERS, 'Content-Type': contentType}});
  } catch {
    return new Response('RU verification unavailable. No global fallback.', {status: 503, headers: HEADERS});
  }
}
