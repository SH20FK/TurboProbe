import type { NodeItem } from '../types';

export interface ClashProxyConfig {
  name: string;
  type: string;
  server: string;
  port: number;
  [key: string]: unknown;
}

/**
 * Safely decodes standard or URL-safe Base64 strings in browser environment.
 */
export function decodeBase64Safe(str: string): string {
  if (!str) return '';
  try {
    let normalized = str.replace(/-/g, '+').replace(/_/g, '/').trim();
    while (normalized.length % 4 !== 0) {
      normalized += '=';
    }
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(normalized), (c: string) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
  } catch {
    try {
      let normalized = str.replace(/-/g, '+').replace(/_/g, '/').trim();
      while (normalized.length % 4 !== 0) {
        normalized += '=';
      }
      return atob(normalized);
    } catch {
      return '';
    }
  }
}

/**
 * Parses any supported proxy URI (vless, trojan, ss, hy2, hysteria2, vmess)
 * into a structured Clash Meta / Mihomo proxy configuration.
 */
export function parseProxyUriToClashProxy(uri: string, index: number, fallbackName?: string): ClashProxyConfig | null {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed.includes('://')) return null;

  // Extract hash remark if available
  let remark = fallbackName || `TurboProbe-${String(index + 1).padStart(3, '0')}`;
  const hashIdx = trimmed.indexOf('#');
  let rawWithoutHash = trimmed;
  if (hashIdx !== -1) {
    const rawRemark = trimmed.slice(hashIdx + 1);
    rawWithoutHash = trimmed.slice(0, hashIdx);
    try {
      const decoded = decodeURIComponent(rawRemark).trim();
      if (decoded) remark = decoded;
    } catch {
      if (rawRemark) remark = rawRemark.trim();
    }
  }

  const protoEnd = rawWithoutHash.indexOf('://');
  const protocol = rawWithoutHash.slice(0, protoEnd).toLowerCase();
  const rest = rawWithoutHash.slice(protoEnd + 3);

  // 1. VMess (Base64 JSON or standard URI)
  if (protocol === 'vmess') {
    if (!rest.includes('@') && !rest.includes('?')) {
      const jsonStr = decodeBase64Safe(rest);
      if (jsonStr) {
        try {
          const v = JSON.parse(jsonStr) as Record<string, unknown>;
          const vServer = String(v.add || v.host || '').replace(/^\[|\]$/g, '');
          const vPort = parseInt(String(v.port || '0'), 10);
          const vUuid = String(v.id || '');
          if (vServer && vPort > 0 && vUuid) {
            const vName = String(v.ps || remark).trim() || remark;
            const isTls = v.tls === 'tls';
            const network = String(v.net || 'tcp').toLowerCase();
            const config: ClashProxyConfig = {
              name: vName,
              type: 'vmess',
              server: vServer,
              port: vPort,
              uuid: vUuid,
              alterId: parseInt(String(v.aid || '0'), 10) || 0,
              cipher: 'auto',
              udp: true,
              tls: isTls,
            };
            if (v.sni || (isTls && v.host)) {
              config.servername = String(v.sni || v.host);
            }
            if (network === 'ws') {
              config.network = 'ws';
              config['ws-opts'] = {
                path: String(v.path || '/'),
                headers: {
                  Host: String(v.host || v.sni || vServer),
                },
              };
            } else if (network === 'grpc') {
              config.network = 'grpc';
              config['grpc-opts'] = {
                'grpc-service-name': String(v.path || ''),
              };
            }
            return config;
          }
        } catch {
          // ignore JSON parse failure
        }
      }
    }
  }

  // 2. Shadowsocks (ss://)
  if (protocol === 'ss') {
    try {
      let userinfo = '';
      let hostPort = '';
      if (rest.includes('@')) {
        const atIdx = rest.indexOf('@');
        userinfo = rest.slice(0, atIdx);
        hostPort = rest.slice(atIdx + 1);
        if (!userinfo.includes(':')) {
          userinfo = decodeBase64Safe(userinfo);
        }
      } else {
        const decoded = decodeBase64Safe(rest);
        if (decoded.includes('@')) {
          const atIdx = decoded.indexOf('@');
          userinfo = decoded.slice(0, atIdx);
          hostPort = decoded.slice(atIdx + 1);
        }
      }

      if (userinfo.includes(':') && hostPort) {
        const colonIdx = userinfo.indexOf(':');
        const cipher = userinfo.slice(0, colonIdx);
        const password = userinfo.slice(colonIdx + 1);

        let host = hostPort;
        let port = 8388;
        if (hostPort.includes('?')) {
          host = hostPort.split('?')[0];
        }
        if (host.startsWith('[')) {
          if (host.includes(']:')) {
            const parts = host.split(']:');
            host = parts[0].replace(/^\[/, '');
            port = parseInt(parts[1], 10) || 8388;
          } else {
            host = host.replace(/^\[|\]$/g, '');
          }
        } else if (host.includes(':')) {
          const lastColon = host.lastIndexOf(':');
          const p = parseInt(host.slice(lastColon + 1), 10);
          if (!isNaN(p)) {
            port = p;
            host = host.slice(0, lastColon);
          }
        }
        host = host.replace(/^\[|\]$/g, '');

        if (host && port > 0) {
          return {
            name: remark,
            type: 'ss',
            server: host,
            port,
            cipher,
            password,
            udp: true,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Standard URL Schemes (vless, trojan, hy2, hysteria2)
  try {
    const fakeUrl = new URL(`http://${rest}`);
    const host = fakeUrl.hostname.replace(/^\[|\]$/g, '');
    const port = parseInt(fakeUrl.port, 10);
    const user = decodeURIComponent(fakeUrl.username || '');
    const searchParams = fakeUrl.searchParams;

    if (!host || isNaN(port) || port <= 0) return null;

    if (protocol === 'vless') {
      const security = (searchParams.get('security') || '').toLowerCase();
      const isReality = security === 'reality' || searchParams.has('pbk');
      const isTls = isReality || security === 'tls';
      const sni = searchParams.get('sni') || searchParams.get('peer') || host;
      const fp = searchParams.get('fp') || 'chrome';
      const flow = searchParams.get('flow');
      const network = (searchParams.get('type') || 'tcp').toLowerCase();
      const path = searchParams.get('path') || '/';
      const serviceName = searchParams.get('serviceName');

      const config: ClashProxyConfig = {
        name: remark,
        type: 'vless',
        server: host,
        port,
        uuid: user,
        cipher: 'auto',
        udp: true,
        tls: isTls,
      };

      if (isTls) {
        config.servername = sni;
        config['client-fingerprint'] = fp;
      }

      if (flow) {
        config.flow = flow;
      }

      if (isReality) {
        config['reality-opts'] = {
          'public-key': searchParams.get('pbk') || '',
          'short-id': searchParams.get('sid') || '',
        };
      }

      if (network === 'ws') {
        config.network = 'ws';
        config['ws-opts'] = {
          path,
          headers: {
            Host: searchParams.get('host') || sni || host,
          },
        };
      } else if (network === 'grpc') {
        config.network = 'grpc';
        config['grpc-opts'] = {
          'grpc-service-name': serviceName || '',
        };
      } else if (network === 'h2' || network === 'http') {
        config.network = 'h2';
        config['h2-opts'] = {
          host: [searchParams.get('host') || sni || host],
          path,
        };
      }

      return config;
    }

    if (protocol === 'trojan') {
      const sni = searchParams.get('sni') || searchParams.get('peer') || host;
      const allowInsecure = searchParams.get('allowInsecure') === '1' || searchParams.get('insecure') === '1';
      const network = (searchParams.get('type') || 'tcp').toLowerCase();
      const path = searchParams.get('path') || '/';
      const serviceName = searchParams.get('serviceName');

      const config: ClashProxyConfig = {
        name: remark,
        type: 'trojan',
        server: host,
        port,
        password: user,
        udp: true,
        sni,
        'skip-cert-verify': allowInsecure,
      };

      if (network === 'ws') {
        config.network = 'ws';
        config['ws-opts'] = {
          path,
          headers: {
            Host: searchParams.get('host') || sni || host,
          },
        };
      } else if (network === 'grpc') {
        config.network = 'grpc';
        config['grpc-opts'] = {
          'grpc-service-name': serviceName || '',
        };
      }

      return config;
    }

    if (protocol === 'hy2' || protocol === 'hysteria2') {
      const sni = searchParams.get('sni') || host;
      const insecure = searchParams.get('insecure') === '1' || searchParams.get('allowInsecure') === '1';
      const obfs = searchParams.get('obfs');
      const obfsPassword = searchParams.get('obfs-password');

      const config: ClashProxyConfig = {
        name: remark,
        type: 'hysteria2',
        server: host,
        port,
        password: user,
        sni,
        'skip-cert-verify': insecure,
        udp: true,
      };

      if (obfs) {
        config.obfs = obfs;
        if (obfsPassword) {
          config['obfs-password'] = obfsPassword;
        }
      }

      return config;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Formats an object into clean indented YAML string representation.
 */
function formatYamlValue(val: unknown, indent = 4): string {
  const pad = ' '.repeat(indent);
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    // Quote strings containing special characters or colons
    if (val.includes(':') || val.includes('#') || val.includes('"') || val.includes('\n') || val.includes('[') || val.includes(']')) {
      return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return '\n' + val.map((item) => `${pad}- ${formatYamlValue(item, indent + 2)}`).join('\n');
  }
  if (typeof val === 'object') {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        lines.push(`${pad}${k}:\n${formatYamlValue(v, indent + 2)}`);
      } else {
        lines.push(`${pad}${k}: ${formatYamlValue(v, indent + 2)}`);
      }
    }
    return lines.join('\n');
  }
  return String(val);
}

/**
 * Generates a full, valid Clash Meta / Mihomo configuration YAML from NodeItem array.
 */
export function generateClashMetaYaml(nodes: NodeItem[], maxCount = 200): string {
  const parsedProxies: ClashProxyConfig[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < nodes.length && parsedProxies.length < maxCount; i++) {
    const node = nodes[i];
    const proxy = parseProxyUriToClashProxy(node.uri, i, node.remark);
    if (proxy) {
      let uniqueName = proxy.name;
      let counter = 2;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${proxy.name} (${counter++})`;
      }
      proxy.name = uniqueName;
      usedNames.add(uniqueName);
      parsedProxies.push(proxy);
    }
  }

  if (parsedProxies.length === 0) {
    return '# TurboProbe Clash Configuration\n# No valid proxy nodes were found in the current selection\nproxies: []\n';
  }

  const proxyNames = parsedProxies.map((p) => p.name);

  const proxyYamlBlocks = parsedProxies.map((proxy) => {
    const lines: string[] = [`  - name: "${proxy.name.replace(/"/g, '\\"')}"`];
    for (const [key, value] of Object.entries(proxy)) {
      if (key === 'name' || value === undefined) continue;
      if (typeof value === 'object' && value !== null) {
        lines.push(`    ${key}:`);
        lines.push(formatYamlValue(value, 6));
      } else {
        lines.push(`    ${key}: ${formatYamlValue(value, 4)}`);
      }
    }
    return lines.join('\n');
  });

  const proxyNamesListYaml = proxyNames.map((name) => `      - "${name.replace(/"/g, '\\"')}"`).join('\n');

  return `# ===================================================
# TurboProbe Sovereign VPN - Clash Meta Configuration
# Generated: ${new Date().toISOString()}
# Nodes Count: ${parsedProxies.length}
# ===================================================

port: 7890
socks-port: 7891
mixed-port: 7892
allow-lan: false
mode: rule
log-level: info
ipv6: false
external-controller: 127.0.0.1:9090
unified-delay: true
tcp-concurrent: true

dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 77.88.8.8
    - 8.8.8.8
    - 1.1.1.1
  fallback:
    - https://dns.google/dns-query
    - https://1.1.1.1/dns-query

proxies:
${proxyYamlBlocks.join('\n\n')}

proxy-groups:
  - name: "🚀 AUTO-FASTEST"
    type: url-test
    url: http://cp.cloudflare.com/generate_204
    interval: 300
    tolerance: 50
    proxies:
${proxyNamesListYaml}

  - name: "🛡️ SELECT-NODE"
    type: select
    proxies:
      - "🚀 AUTO-FASTEST"
${proxyNamesListYaml}

  - name: "🇷🇺 RU-DIRECT"
    type: select
    proxies:
      - DIRECT
      - "🛡️ SELECT-NODE"

rules:
  - GEOIP,RU,🇷🇺 RU-DIRECT
  - DOMAIN-SUFFIX,ru,🇷🇺 RU-DIRECT
  - DOMAIN-SUFFIX,xn--p1ai,🇷🇺 RU-DIRECT
  - DOMAIN-KEYWORD,yandex,🇷🇺 RU-DIRECT
  - DOMAIN-KEYWORD,vk,🇷🇺 RU-DIRECT
  - MATCH,🛡️ SELECT-NODE
`;
}
