/**
 * ⚡ TurboProbe Stress Test Harness: Web Frontend Scale
 * Tests nodeIndexer, complex filtering, dynamic counts, and Clash export
 * against 5,000 and 10,000 synthetic nodes.
 */

import { performance } from 'node:perf_hooks';
import { normalizeAndIndexNodes, indexNode, extractCountryTokens, extractRemark } from '../turboprobe-web/src/utils/nodeIndexer.ts';
import { generateClashMetaYaml, parseProxyUriToClashProxy } from '../turboprobe-web/src/utils/clashExport.ts';
import type { NodeItem } from '../turboprobe-web/src/types/index.ts';

// 1. Synthetic Node Generator
const COUNTRIES = ['DE', 'NL', 'US', 'RU', 'KZ', 'FI', 'TR', 'FR', 'GB', 'SG', 'JP', 'CO', 'AM', 'GLOBAL', ''];
const SERVICES_LIST = ['youtube', 'discord', 'telegram', 'instagram', 'chatgpt', 'gemini', 'claude', 'ruservices'];

function generateSyntheticNodes(count: number): NodeItem[] {
  const nodes: NodeItem[] = [];
  const protocols = ['vless', 'trojan', 'ss', 'hysteria2', 'hy2', 'vmess'];

  for (let i = 0; i < count; i++) {
    const proto = protocols[i % protocols.length];
    const country = COUNTRIES[i % COUNTRIES.length];
    const ping = 15 + ((i * 17) % 785);
    const health = 20 + ((i * 7) % 81);
    const server = `198.51.${(i >> 8) % 250 + 1}.${(i % 250) + 1}`;
    const port = 443 + (i % 1000);

    const services: Record<string, boolean> = {};
    for (let sIdx = 0; sIdx < SERVICES_LIST.length; sIdx++) {
      if ((i + sIdx) % 3 === 0) {
        services[SERVICES_LIST[sIdx]] = true;
      }
    }

    let uri = '';
    const remarkTag = `⚡ TurboProbe [${country || 'NL'}] Node-${i + 1} #VIP:"Прокси" 'Speed'`;

    if (proto === 'vless') {
      const isReality = i % 2 === 0;
      if (isReality) {
        uri = `vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@${server}:${port}?security=reality&sni=microsoft.com&fp=chrome&pbk=ABCD1234EFGH5678&sid=1234abcd&flow=xtls-rprx-vision&type=tcp#${encodeURIComponent(remarkTag)}`;
      } else {
        uri = `vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@${server}:${port}?security=tls&sni=cdn.example.com&type=ws&path=%2Fws#${encodeURIComponent(remarkTag)}`;
      }
    } else if (proto === 'trojan') {
      uri = `trojan://TrojanPassword123@${server}:${port}?security=tls&sni=trojan.example.com#${encodeURIComponent(remarkTag)}`;
    } else if (proto === 'ss') {
      const userinfo = Buffer.from(`aes-256-gcm:pass-${i}`).toString('base64');
      uri = `ss://${userinfo}@${server}:${port}#${encodeURIComponent(remarkTag)}`;
    } else if (proto === 'hysteria2' || proto === 'hy2') {
      uri = `hy2://Hy2Secret@${server}:${port}?sni=hy2.example.com&insecure=1#${encodeURIComponent(remarkTag)}`;
    } else {
      // vmess
      const vmessObj = {
        v: '2',
        ps: remarkTag,
        add: server,
        port: port,
        id: '83afd88f-200f-4d89-bfc7-66eff160c1d8',
        aid: '0',
        net: 'ws',
        type: 'none',
        host: 'vmess.example.com',
        path: '/vmess',
        tls: 'tls',
        sni: 'vmess.example.com'
      };
      uri = `vmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`;
    }

    nodes.push({
      id: `node-${i}`,
      uri,
      protocol: (proto === 'hy2' ? 'hysteria2' : proto) as any,
      server,
      port,
      country: country || 'GLOBAL',
      remark: remarkTag,
      ping_ms: ping,
      health,
      speed_mbps: 10 + (i % 90),
      ru_verified: country === 'RU' || i % 5 === 0,
      services
    });
  }

  return nodes;
}

// 2. Filtering Function matching App.tsx logic exactly
function filterNodes(
  allNodes: NodeItem[],
  selectedServices: string[] = [],
  selectedCountries: string[] = [],
  selectedProtos: string[] = [],
  maxPing = 0,
  minHealth = 0
): NodeItem[] {
  const hasServices = selectedServices.length > 0;
  const hasCountries = selectedCountries.length > 0;
  const hasProtos = selectedProtos.length > 0;
  const hasMaxPing = maxPing > 0;
  const hasMinHealth = minHealth > 0;

  if (!hasServices && !hasCountries && !hasProtos && !hasMaxPing && !hasMinHealth) {
    return allNodes;
  }

  const normCountries = hasCountries ? selectedCountries.map((c) => c.toLowerCase().trim()) : [];
  const normProtos = hasProtos ? selectedProtos.map((p) => p.toLowerCase().trim()) : [];

  return allNodes.filter((node) => {
    const idx = node._index;

    // 1. Max Ping
    if (hasMaxPing) {
      const ping = idx ? idx.ping : (typeof node.ping_ms === 'number' ? node.ping_ms : 999);
      if (ping > maxPing) return false;
    }

    // 2. Min Health
    if (hasMinHealth) {
      const health = idx ? idx.health : (typeof node.health === 'number' ? node.health : 100);
      if (health < minHealth) return false;
    }

    // 3. Service filter
    if (hasServices) {
      if (idx) {
        const matchService = selectedServices.some((s) => idx.serviceSet.has(s.toLowerCase()));
        if (!matchService) return false;
      } else if (node.services) {
        const matchService = selectedServices.some((s) => Boolean(node.services![s]));
        if (!matchService) return false;
      } else {
        return false;
      }
    }

    // 4. Country filter
    if (hasCountries) {
      if (idx) {
        const matchCountry = normCountries.some(
          (c) => idx.normalizedCountry === c || idx.countryTokens.includes(c)
        );
        if (!matchCountry) return false;
      } else {
        const c = (node.country || '').toLowerCase().trim();
        const matchCountry = normCountries.some((target) => c === target);
        if (!matchCountry) return false;
      }
    }

    // 5. Protocol filter
    if (hasProtos) {
      if (idx) {
        const matchProto = normProtos.some((p) => {
          if (p === 'reality') return idx.isReality;
          if (p === 'hy2') return idx.isHy2;
          if (p === 'trojan') return idx.isTrojan;
          if (p === 'ss') return idx.isSs;
          if (p === 'vless') return idx.isVless;
          return idx.normalizedProto.includes(p);
        });
        if (!matchProto) return false;
      } else {
        const p = (node.protocol || '').toLowerCase();
        const matchProto = normProtos.some((proto) => p.includes(proto));
        if (!matchProto) return false;
      }
    }

    return true;
  });
}

function computeCounts(allNodes: NodeItem[]) {
  const countryMap: Record<string, number> = {};
  const protoMap: Record<string, number> = {};

  for (let i = 0; i < allNodes.length; i++) {
    const n = allNodes[i];
    const c = n._index?.normalizedCountry || (n.country || '').toLowerCase().trim();
    if (c && c !== 'global' && c !== 'all') {
      countryMap[c] = (countryMap[c] || 0) + 1;
    }

    const idx = n._index;
    if (idx) {
      if (idx.isReality) protoMap['reality'] = (protoMap['reality'] || 0) + 1;
      else if (idx.isHy2) protoMap['hy2'] = (protoMap['hy2'] || 0) + 1;
      else if (idx.isTrojan) protoMap['trojan'] = (protoMap['trojan'] || 0) + 1;
      else if (idx.isSs) protoMap['ss'] = (protoMap['ss'] || 0) + 1;
      else if (idx.isVless) protoMap['vless'] = (protoMap['vless'] || 0) + 1;
    }
  }

  return { countryMap, protoMap };
}

// 3. Execution Benchmark Harness
async function runScaleHarness() {
  console.log('='.repeat(80));
  console.log('⚡ STRESS HARNESS 1: Web Frontend Scale (5,000 & 10,000 Synthetic Nodes)');
  console.log('='.repeat(80));

  const results: Record<string, any> = {};

  for (const scale of [5000, 10000]) {
    console.log(`\n▶ Generating ${scale} synthetic nodes...`);
    const rawNodes = generateSyntheticNodes(scale);

    // Test 1: Indexing performance
    const memBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    const indexedNodes = normalizeAndIndexNodes(rawNodes);
    const t1 = performance.now();
    const memAfter = process.memoryUsage().heapUsed;

    const indexDurationMs = t1 - t0;
    const memDeltaMb = (memAfter - memBefore) / (1024 * 1024);
    const itemsPerMs = scale / indexDurationMs;

    console.log(`  ✓ Indexing Time (${scale} nodes): ${indexDurationMs.toFixed(2)} ms (${itemsPerMs.toFixed(0)} nodes/ms)`);
    console.log(`  ✓ Heap Delta: ${memDeltaMb.toFixed(2)} MB`);

    if (indexDurationMs > 250) {
      throw new Error(`Indexing latency ${indexDurationMs.toFixed(2)}ms exceeded budget of 250ms!`);
    }

    // Verify index correctness
    for (let i = 0; i < Math.min(100, scale); i++) {
      const n = indexedNodes[i];
      if (!n._index) throw new Error(`Missing _index on node ${i}`);
      if (typeof n._index.ping !== 'number') throw new Error(`Invalid ping on node ${i}`);
      if (!(n._index.serviceSet instanceof Set)) throw new Error(`Invalid serviceSet on node ${i}`);
    }

    // Test 2: Dynamic counts computation
    const tCount0 = performance.now();
    const counts = computeCounts(indexedNodes);
    const tCount1 = performance.now();
    const countDurationMs = tCount1 - tCount0;
    console.log(`  ✓ Dynamic Counts Calculation (${scale} nodes): ${countDurationMs.toFixed(2)} ms`);

    // Test 3: Multi-query Filtering Benchmarks
    const queries = [
      { name: 'Preset All (No filter)', services: [], countries: [], protos: [], maxPing: 0, minHealth: 0 },
      { name: 'Single Service (youtube)', services: ['youtube'], countries: [], protos: [], maxPing: 0, minHealth: 0 },
      { name: 'Multi-Service (chatgpt + gemini + claude)', services: ['chatgpt', 'gemini', 'claude'], countries: [], protos: [], maxPing: 0, minHealth: 0 },
      { name: 'Single Country (de)', services: [], countries: ['de'], protos: [], maxPing: 0, minHealth: 0 },
      { name: 'Multi-Country (de + nl + us)', services: [], countries: ['de', 'nl', 'us'], protos: [], maxPing: 0, minHealth: 0 },
      { name: 'Single Protocol (reality)', services: [], countries: [], protos: ['reality'], maxPing: 0, minHealth: 0 },
      { name: 'Multi-Protocol (reality + hy2)', services: [], countries: [], protos: ['reality', 'hy2'], maxPing: 0, minHealth: 0 },
      { name: 'Full Multi-Dimension (yt + de + reality + ping<150 + health>50)', services: ['youtube'], countries: ['de'], protos: ['reality'], maxPing: 150, minHealth: 50 },
      { name: 'Narrow Selectivity (kz + ping<40 + health>80)', services: [], countries: ['kz'], protos: [], maxPing: 40, minHealth: 80 },
    ];

    console.log(`  ▶ Running 100 filter cycles per query...`);
    const queryMetrics: any[] = [];

    for (const q of queries) {
      const filterTimes: number[] = [];
      let matchCount = 0;

      // Warmup
      filterNodes(indexedNodes, q.services, q.countries, q.protos, q.maxPing, q.minHealth);

      const ITERATIONS = 100;
      const tStart = performance.now();
      for (let it = 0; it < ITERATIONS; it++) {
        const tQ0 = performance.now();
        const matches = filterNodes(indexedNodes, q.services, q.countries, q.protos, q.maxPing, q.minHealth);
        const tQ1 = performance.now();
        filterTimes.push(tQ1 - tQ0);
        if (it === 0) matchCount = matches.length;
      }
      const tTotal = performance.now() - tStart;
      const avgMs = tTotal / ITERATIONS;
      const opsPerSec = (ITERATIONS / tTotal) * 1000;

      filterTimes.sort((a, b) => a - b);
      const p50 = filterTimes[Math.floor(ITERATIONS * 0.5)];
      const p95 = filterTimes[Math.floor(ITERATIONS * 0.95)];
      const p99 = filterTimes[Math.floor(ITERATIONS * 0.99)];

      queryMetrics.push({
        query: q.name,
        matches: matchCount,
        avgMs: avgMs.toFixed(3),
        p50Ms: p50.toFixed(3),
        p95Ms: p95.toFixed(3),
        p99Ms: p99.toFixed(3),
        opsPerSec: Math.round(opsPerSec)
      });

      console.log(`    - [${q.name}]: ${matchCount} matches | Avg: ${avgMs.toFixed(3)}ms | P95: ${p95.toFixed(3)}ms | ${Math.round(opsPerSec)} ops/sec`);

      if (avgMs > 10.0) {
        throw new Error(`Filter latency ${avgMs.toFixed(3)}ms for "${q.name}" exceeded budget of 10.0ms!`);
      }
    }

    // Test 4: Clash Meta Export Generation on scale
    const tExport0 = performance.now();
    const yamlExport = generateClashMetaYaml(indexedNodes, 200);
    const tExport1 = performance.now();
    const exportMs = tExport1 - tExport0;
    console.log(`  ✓ Clash Meta YAML Export Generation (top 200 from ${scale} nodes): ${exportMs.toFixed(2)} ms (Length: ${yamlExport.length} chars)`);

    results[`scale_${scale}`] = {
      indexingMs: indexDurationMs,
      indexingThroughputNodesPerMs: itemsPerMs,
      heapDeltaMb: memDeltaMb,
      countsDurationMs: countDurationMs,
      clashExportMs: exportMs,
      queries: queryMetrics
    };
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Web Frontend Scale Stress Test PASSED without errors!');
  console.log('='.repeat(80));
  return results;
}

runScaleHarness()
  .then((res) => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Scale Harness FAILED:', err);
    process.exit(1);
  });
