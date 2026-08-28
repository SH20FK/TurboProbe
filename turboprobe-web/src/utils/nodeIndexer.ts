import type { NodeItem, NodeIndexMetadata } from '../types';

/**
 * Extracts and decodes the human-readable remark/tag from a proxy URI.
 */
export function extractRemark(uri: string): string {
  if (!uri || typeof uri !== 'string') return 'TurboProbe Node';
  if (uri.includes('#')) {
    try {
      const tag = decodeURIComponent(uri.split('#')[1]).replace(/[:"'[\]]/g, '').trim();
      if (tag) return tag;
    } catch {
      const rawTag = uri.split('#')[1].trim();
      if (rawTag) return rawTag;
    }
  }
  return 'TurboProbe Node';
}

/**
 * Computes synchronized display title for a node given its remark and verified country.
 */
export function computeDisplayTitle(remark: string, country?: string): string {
  let title = remark;
  if (country && country !== 'GLOBAL' && country !== 'all' && country.trim() !== '') {
    const cc = country.trim().toUpperCase();
    title = title.replace(/·\s*(?:[^\w\s]{1,4}\s*)?[A-Za-z]{2}(?:\s+[A-Za-z]{2})?\b/g, `· ${cc}`);
  }
  return title;
}

/**
 * Extracts country matching tokens from country and URI remark for O(1) matching.
 */
export function extractCountryTokens(country?: string, uri = ''): string[] {
  const tokens = new Set<string>();
  const normCountry = (country || '').toLowerCase().trim();
  if (normCountry && normCountry !== 'global' && normCountry !== 'all') {
    tokens.add(normCountry);
  }

  if (uri.includes('#')) {
    const tag = uri.split('#')[1].toLowerCase();
    // Common patterns: [de], (de), -de-, " de "
    const matches = tag.match(/(?:\[|\(|-|\s)([a-z]{2})(?:\]|\)|-|\s)/g);
    if (matches) {
      for (const m of matches) {
        const code = m.replace(/[^a-z]/g, '');
        if (code.length === 2) {
          tokens.add(code);
        }
      }
    }
  }

  return Array.from(tokens);
}

/**
 * Pre-indexes a single node with normalized lookup metadata.
 */
export function indexNode(node: NodeItem, index: number): NodeItem {
  const uri = (node.uri || '').trim();
  const rawProto = (node.protocol || (uri.split('://')[0] || 'vless')).toLowerCase().trim();
  const lowerUri = uri.toLowerCase();

  const isReality = lowerUri.includes('pbk=') || rawProto.includes('reality');
  const isHy2 = rawProto.includes('hy2') || rawProto.includes('hysteria2') || lowerUri.startsWith('hy2://') || lowerUri.startsWith('hysteria2://');
  const isTrojan = rawProto.includes('trojan') || lowerUri.startsWith('trojan://');
  const isSs = rawProto.includes('ss') || rawProto.includes('shadowsocks') || lowerUri.startsWith('ss://');
  const isVless = rawProto.includes('vless') || lowerUri.startsWith('vless://');
  const isVmess = rawProto.includes('vmess') || lowerUri.startsWith('vmess://');
  const isTuic = rawProto.includes('tuic') || lowerUri.startsWith('tuic://');

  const cleanTag = extractRemark(uri);
  const normalizedCountry = (node.country || '').toLowerCase().trim();
  const displayTitle = computeDisplayTitle(cleanTag, node.country);
  const countryTokens = extractCountryTokens(node.country, uri);

  const serviceSet = new Set<string>();
  if (node.services && typeof node.services === 'object') {
    for (const [k, v] of Object.entries(node.services)) {
      if (v) {
        serviceSet.add(k.toLowerCase());
      }
    }
  }

  const ping = typeof node.ping_ms === 'number' && node.ping_ms > 0 ? node.ping_ms : 0;
  const health = typeof node.health === 'number' ? node.health : 100;
  const id = node.id || uri || `node-${index}`;

  const indexMetadata: NodeIndexMetadata = {
    id,
    cleanTag,
    displayTitle,
    normalizedCountry,
    normalizedProto: rawProto,
    isReality,
    isHy2,
    isTrojan,
    isSs,
    isVless,
    isVmess,
    isTuic,
    ping,
    health,
    serviceSet,
    countryTokens,
  };

  return {
    ...node,
    id,
    ping_ms: ping,
    health,
    _index: indexMetadata,
  };
}

/**
 * Batch indexes an array of NodeItems for ultra-fast filtering.
 */
export function normalizeAndIndexNodes(nodes: NodeItem[]): NodeItem[] {
  return nodes.map((n, idx) => indexNode(n, idx));
}
