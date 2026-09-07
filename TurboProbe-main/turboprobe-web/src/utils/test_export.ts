import { parseProxyUriToClashProxy, generateClashMetaYaml } from './clashExport.ts';
import { indexNode, extractCountryTokens, computeDisplayTitle } from './nodeIndexer.ts';
import type { NodeItem } from '../types/index.ts';

function runTests() {
  console.log('--- Running Frontend Verification Tests ---');

  // Test 1: VLESS Reality
  const vlessUri = 'vless://11111111-2222-3333-4444-555555555555@1.2.3.4:443?security=reality&pbk=abcdef123456&sid=1234&sni=yahoo.com&fp=chrome#VLESS-DE-Server%20%5Bde%5D';
  const vlessProxy = parseProxyUriToClashProxy(vlessUri, 0);
  if (!vlessProxy || vlessProxy.type !== 'vless' || vlessProxy.server !== '1.2.3.4' || vlessProxy.port !== 443) {
    throw new Error('VLESS parsing failed: ' + JSON.stringify(vlessProxy));
  }
  const realityOpts = vlessProxy['reality-opts'] as Record<string, string>;
  if (!realityOpts || realityOpts['public-key'] !== 'abcdef123456' || realityOpts['short-id'] !== '1234') {
    throw new Error('VLESS reality-opts failed: ' + JSON.stringify(vlessProxy));
  }
  console.log('✓ Test 1: VLESS Reality parsed successfully');

  // Test 2: Trojan
  const trojanUri = 'trojan://secretpassword@trojan.example.com:8443?sni=trojan.example.com&insecure=1&type=ws&path=%2Fws#Trojan-NL';
  const trojanProxy = parseProxyUriToClashProxy(trojanUri, 1);
  if (!trojanProxy || trojanProxy.type !== 'trojan' || trojanProxy.server !== 'trojan.example.com' || trojanProxy.port !== 8443) {
    throw new Error('Trojan parsing failed: ' + JSON.stringify(trojanProxy));
  }
  if (trojanProxy['skip-cert-verify'] !== true || trojanProxy.network !== 'ws') {
    throw new Error('Trojan ws/insecure failed: ' + JSON.stringify(trojanProxy));
  }
  console.log('✓ Test 2: Trojan parsed successfully');

  // Test 3: Shadowsocks (Base64)
  // btoa('aes-256-gcm:mypassword') => YWVzLTI1Ni1nY206bXlwYXNzd29yZA==
  const ssUri = 'ss://YWVzLTI1Ni1nY206bXlwYXNzd29yZA==@ss.example.com:8388#SS-FI-Node';
  const ssProxy = parseProxyUriToClashProxy(ssUri, 2);
  if (!ssProxy || ssProxy.type !== 'ss' || ssProxy.server !== 'ss.example.com' || ssProxy.port !== 8388) {
    throw new Error('SS parsing failed: ' + JSON.stringify(ssProxy));
  }
  if (ssProxy.cipher !== 'aes-256-gcm' || ssProxy.password !== 'mypassword') {
    throw new Error('SS cipher/password failed: ' + JSON.stringify(ssProxy));
  }
  console.log('✓ Test 3: Shadowsocks parsed successfully');

  // Test 4: Hysteria 2
  const hy2Uri = 'hy2://authpass@hy2.example.com:443?sni=hy2.example.com&insecure=1&obfs=salamander&obfs-password=obfspass#Hy2-TR';
  const hy2Proxy = parseProxyUriToClashProxy(hy2Uri, 3);
  if (!hy2Proxy || hy2Proxy.type !== 'hysteria2' || hy2Proxy.server !== 'hy2.example.com' || hy2Proxy.port !== 443) {
    throw new Error('Hy2 parsing failed: ' + JSON.stringify(hy2Proxy));
  }
  if (hy2Proxy.password !== 'authpass' || hy2Proxy.obfs !== 'salamander' || hy2Proxy['obfs-password'] !== 'obfspass') {
    throw new Error('Hy2 obfs/auth failed: ' + JSON.stringify(hy2Proxy));
  }
  console.log('✓ Test 4: Hysteria 2 parsed successfully');

  // Test 5: Full Clash Meta YAML Generation
  const testNodes: NodeItem[] = [
    { uri: vlessUri, country: 'DE', ping_ms: 45, speed_mbps: 120.5, ru_verified: true },
    { uri: trojanUri, country: 'NL', ping_ms: 0, speed_mbps: 85.0 }, // test 0ms ping!
    { uri: hy2Uri, country: 'TR', ping_ms: 60, health: 98 },
  ];
  const yaml = generateClashMetaYaml(testNodes);
  if (!yaml.includes('proxies:') || !yaml.includes('proxy-groups:') || !yaml.includes('rules:')) {
    throw new Error('Clash YAML missing core sections');
  }
  if (!yaml.includes('type: vless') || !yaml.includes('type: trojan') || !yaml.includes('type: hysteria2')) {
    throw new Error('Clash YAML missing proxy types');
  }
  console.log('✓ Test 5: Clash Meta YAML generated cleanly');

  // Test 6: Node Indexer & 0ms ping
  const indexed = testNodes.map((n, i) => indexNode(n, i));
  if (indexed[1].ping_ms !== 0) {
    throw new Error('ping_ms === 0 was not preserved: ' + indexed[1].ping_ms);
  }
  if (indexed[0]._index?.normalizedCountry !== 'de' || !indexed[0]._index?.countryTokens.includes('de')) {
    throw new Error('Country indexing failed: ' + JSON.stringify(indexed[0]._index));
  }
  if (!indexed[0]._index?.isReality || !indexed[2]._index?.isHy2) {
    throw new Error('Protocol flags indexing failed');
  }
  console.log('✓ Test 6: Node Indexer preserved 0ms ping and indexed metadata correctly');

  // Test 7: extractCountryTokens & computeDisplayTitle
  const tokens = extractCountryTokens('DE', 'vless://uuid@host:443#Server [dk] (rs) -nz-');
  if (!tokens.includes('de') || !tokens.includes('dk') || !tokens.includes('rs') || !tokens.includes('nz')) {
    throw new Error('Country tokens extraction failed: ' + JSON.stringify(tokens));
  }
  const title = computeDisplayTitle('TurboProbe Server · DE', 'NL');
  if (title !== 'TurboProbe Server · NL') {
    throw new Error('computeDisplayTitle failed: ' + title);
  }
  console.log('✓ Test 7: Country tokens and display title synchronization verified');

  console.log('--- ALL FRONTEND VERIFICATION TESTS PASSED ---');
}

runTests();
