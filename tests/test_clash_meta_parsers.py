#!/usr/bin/env python3
"""
⚡ TurboProbe Clash Meta YAML Parser & Mihomo Strict Schema Validation Harness
Performs deep adversarial verification of generated Clash Meta configurations
from tools/aggregator.py, tools/service_prober.py, worker/index.js,
and turboprobe-web/src/utils/clashExport.ts against PyYAML and strict Mihomo schema specifications.
"""

import os
import sys
import json
import base64
import subprocess
import unittest
import urllib.parse
import yaml

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

import aggregator
import service_prober

# Strict Mihomo / Clash Meta Schema Validator
BUILTIN_PROXIES = {"DIRECT", "REJECT", "GLOBAL", "COMPATIBLE"}
VALID_PROXY_TYPES = {"vless", "trojan", "ss", "shadowsocks", "hysteria2", "hy2", "vmess", "tuic", "wireguard", "http", "socks5"}
VALID_GROUP_TYPES = {"select", "url-test", "fallback", "load-balance"}

def validate_mihomo_clash_yaml(yaml_content: str, source_name: str = "Unknown"):
    """
    Validates a Clash Meta YAML configuration against strict PyYAML parser
    and Mihomo specification requirements. Raises AssertionError on schema violation.
    """
    assert isinstance(yaml_content, str), f"[{source_name}] YAML content must be string"
    assert len(yaml_content.strip()) > 0, f"[{source_name}] YAML content is empty"

    # Step 1: Strict PyYAML safe parsing
    try:
        data = yaml.safe_load(yaml_content)
    except yaml.YAMLError as e:
        raise AssertionError(f"[{source_name}] PyYAML Scanner/Parser error: {e}") from e

    assert isinstance(data, dict), f"[{source_name}] Root YAML structure must be a dict/mapping, got {type(data)}"

    # Step 2: Root keys verification
    assert "proxies" in data, f"[{source_name}] Missing 'proxies' key in root"
    assert isinstance(data["proxies"], list), f"[{source_name}] 'proxies' must be a list"

    # Step 3: Proxies Validation & Uniqueness
    declared_proxy_names = set()
    for idx, p in enumerate(data["proxies"]):
        assert isinstance(p, dict), f"[{source_name}] Proxy item #{idx+1} must be a dict"
        assert "name" in p and isinstance(p["name"], str) and p["name"].strip(), f"[{source_name}] Proxy #{idx+1} missing valid 'name'"
        name = p["name"]
        assert name not in declared_proxy_names, f"[{source_name}] Duplicate proxy name detected: '{name}'"
        declared_proxy_names.add(name)

        assert "type" in p and isinstance(p["type"], str), f"[{source_name}] Proxy '{name}' missing 'type'"
        ptype = p["type"].lower()
        assert ptype in VALID_PROXY_TYPES, f"[{source_name}] Proxy '{name}' invalid type: '{ptype}'"

        assert "server" in p and str(p["server"]).strip(), f"[{source_name}] Proxy '{name}' missing 'server'"
        # Server must not have leftover outer brackets if parsed from IPv6
        server_str = str(p["server"])
        assert not (server_str.startswith("[") and server_str.endswith("]")), f"[{source_name}] Server '{server_str}' has unstripped brackets"

        assert "port" in p, f"[{source_name}] Proxy '{name}' missing 'port'"
        port = int(p["port"])
        assert 1 <= port <= 65535, f"[{source_name}] Proxy '{name}' port {port} out of range (1..65535)"

        # Protocol-specific validations
        if ptype == "vless":
            assert "uuid" in p and p["uuid"], f"[{source_name}] VLESS proxy '{name}' missing 'uuid'"
            if p.get("reality-opts"):
                assert isinstance(p["reality-opts"], dict), f"[{source_name}] VLESS '{name}' reality-opts must be dict"
                assert "public-key" in p["reality-opts"] and p["reality-opts"]["public-key"], f"[{source_name}] VLESS '{name}' reality-opts missing 'public-key'"
            if p.get("network") == "ws" and p.get("ws-opts"):
                assert isinstance(p["ws-opts"], dict), f"[{source_name}] VLESS '{name}' ws-opts must be dict"
                assert "path" in p["ws-opts"], f"[{source_name}] VLESS '{name}' ws-opts missing 'path'"
            if p.get("network") == "grpc" and p.get("grpc-opts"):
                assert isinstance(p["grpc-opts"], dict), f"[{source_name}] VLESS '{name}' grpc-opts must be dict"

        elif ptype == "trojan":
            assert "password" in p and p["password"], f"[{source_name}] Trojan proxy '{name}' missing 'password'"

        elif ptype in ("ss", "shadowsocks"):
            assert "cipher" in p and p["cipher"], f"[{source_name}] Shadowsocks proxy '{name}' missing 'cipher'"
            assert "password" in p and p["password"], f"[{source_name}] Shadowsocks proxy '{name}' missing 'password'"

        elif ptype in ("hy2", "hysteria2"):
            assert "password" in p or "auth" in p, f"[{source_name}] Hysteria2 proxy '{name}' missing 'password'/'auth'"

    # Step 4: Proxy Groups Validation (if present)
    declared_group_names = set()
    if "proxy-groups" in data and data["proxy-groups"] is not None:
        assert isinstance(data["proxy-groups"], list), f"[{source_name}] 'proxy-groups' must be a list"
        for idx, g in enumerate(data["proxy-groups"]):
            assert isinstance(g, dict), f"[{source_name}] Group #{idx+1} must be a dict"
            assert "name" in g and isinstance(g["name"], str) and g["name"].strip(), f"[{source_name}] Group #{idx+1} missing 'name'"
            gname = g["name"]
            assert gname not in declared_group_names, f"[{source_name}] Duplicate group name '{gname}'"
            declared_group_names.add(gname)

            assert "type" in g and str(g["type"]).lower() in VALID_GROUP_TYPES, f"[{source_name}] Group '{gname}' invalid type '{g.get('type')}'"
            assert "proxies" in g and isinstance(g["proxies"], list), f"[{source_name}] Group '{gname}' missing 'proxies' list"

            if str(g["type"]).lower() == "url-test":
                assert "url" in g and str(g["url"]).startswith("http"), f"[{source_name}] URL-test group '{gname}' missing valid test 'url'"
                assert "interval" in g, f"[{source_name}] URL-test group '{gname}' missing 'interval'"

        # Reference integrity: All group member references must exist
        all_valid_targets = declared_proxy_names | declared_group_names | BUILTIN_PROXIES
        for g in data["proxy-groups"]:
            for target in g["proxies"]:
                assert target in all_valid_targets, f"[{source_name}] Group '{g['name']}' references unknown proxy/group: '{target}'"

    # Step 5: Rules Validation (if present)
    if "rules" in data and data["rules"] is not None:
        assert isinstance(data["rules"], list), f"[{source_name}] 'rules' must be a list"
        all_valid_targets = declared_group_names | declared_proxy_names | BUILTIN_PROXIES
        for idx, rule in enumerate(data["rules"]):
            assert isinstance(rule, str), f"[{source_name}] Rule #{idx+1} must be a string: {rule}"
            parts = [p.strip() for p in rule.split(",")]
            assert len(parts) >= 2, f"[{source_name}] Malformed rule #{idx+1}: '{rule}'"
            target_policy = parts[-1]
            if target_policy.lower() == "no-resolve" and len(parts) >= 3:
                target_policy = parts[-2]
            assert target_policy in all_valid_targets, f"[{source_name}] Rule '{rule}' targets unknown policy '{target_policy}'"

    return {
        "proxies_count": len(data["proxies"]),
        "groups_count": len(data.get("proxy-groups", []) or []),
        "rules_count": len(data.get("rules", []) or [])
    }


class TestClashMetaYamlValidation(unittest.TestCase):
    """Deep validation of all Clash Meta YAML configs and generators."""

    def setUp(self):
        self.adversarial_nodes = [
            # 1. VLESS Reality with colons, quotes, Cyrillic, emoji in tag
            "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&sni=microsoft.com&fp=chrome&pbk=ABCD1234EFGH5678&sid=1234abcd&flow=xtls-rprx-vision&type=tcp#🚀 [DE] Turbo: \"Super\" 'Fast' #1 (Reality)",
            # 2. VLESS WebSocket with custom path and host headers
            "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.2:8443?security=tls&sni=cdn.example.com&type=ws&path=%2Fchat-stream%3Fsession%3D123&host=cdn.example.com#NL: WS/TLS Proxy",
            # 3. VLESS gRPC
            "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.3:443?security=tls&sni=grpc.example.com&type=grpc&serviceName=gun-tunnel#US-gRPC-Node",
            # 4. Trojan with special character password
            "trojan://Tr%3Aoj%22an%23Pass123@198.51.100.4:443?security=tls&sni=trojan.example.com#Trojan: Special [Pass] #4",
            # 5. Shadowsocks SIP002 Base64
            f"ss://{base64.b64encode(b'aes-256-gcm:p@ss:w0rd!').decode()}@198.51.100.5:8388#SS: AEAD GCM #5",
            # 6. Shadowsocks Unpadded Base64
            "ss://YWVzLTEyOC1nY206cGFzc3dvcmQ@198.51.100.6:8388#SS: Unpadded #6",
            # 7. Hysteria 2 with multi-port and obfs
            "hysteria2://Hy2Secret@198.51.100.7:443?sni=hy2.example.com&insecure=1&ports=20000-30000&obfs=salamander&obfs-password=ObfsSecret123#Hy2: Multi-Port [20000-30000] #7",
            # 8. IPv6 Host
            "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@[2001:db8::1]:443?security=reality&sni=example.com&pbk=ABCD1234EFGH5678#IPv6: [2001:db8::1] #8"
        ]

    def test_01_static_sub_clash_yaml_files(self):
        """Validate existing static Clash YAML files in sub/"""
        sub_dir = os.path.join(PROJECT_ROOT, "sub")
        for fname in ["clash.yaml", "clash-meta.yaml", "clash.meta.yaml"]:
            path = os.path.join(sub_dir, fname)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                metrics = validate_mihomo_clash_yaml(content, f"Static sub/{fname}")
                print(f"  ✓ Validated sub/{fname}: {metrics['proxies_count']} proxies, {metrics['groups_count']} groups, {metrics['rules_count']} rules")

    def test_02_aggregator_clash_meta_generator(self):
        """Validate tools/aggregator.py generate_clash_meta_yaml under adversarial inputs"""
        yaml_out = aggregator.generate_clash_meta_yaml(self.adversarial_nodes)
        metrics = validate_mihomo_clash_yaml(yaml_out, "tools/aggregator.py")
        self.assertGreaterEqual(metrics["proxies_count"], 7)
        self.assertGreaterEqual(metrics["groups_count"], 2)
        print(f"  ✓ Validated tools/aggregator.py: {metrics['proxies_count']} proxies, {metrics['groups_count']} groups")

    def test_03_service_prober_clash_meta_generator(self):
        """Validate tools/service_prober.py generate_clash_meta_yaml under adversarial inputs"""
        node_dicts = [{"uri": u, "country": "DE"} for u in self.adversarial_nodes]
        yaml_out = service_prober.generate_clash_meta_yaml(node_dicts)
        metrics = validate_mihomo_clash_yaml(yaml_out, "tools/service_prober.py")
        self.assertGreaterEqual(metrics["proxies_count"], 7)
        self.assertGreaterEqual(metrics["groups_count"], 2)
        print(f"  ✓ Validated tools/service_prober.py: {metrics['proxies_count']} proxies, {metrics['groups_count']} groups")

    def test_04_web_frontend_clash_export_generator(self):
        """Validate turboprobe-web/src/utils/clashExport.ts via Node execution"""
        script = f"""
import {{ generateClashMetaYaml }} from './turboprobe-web/src/utils/clashExport.ts';
const uris = {json.dumps(self.adversarial_nodes)};
const nodes = uris.map((uri, idx) => ({{
  id: 'node-' + idx,
  uri,
  country: 'DE',
  protocol: uri.split('://')[0],
  remark: 'Remark ' + idx
}}));
const yaml = generateClashMetaYaml(nodes);
console.log(yaml);
"""
        res = subprocess.run(
            ["node", "--experimental-strip-types", "-e", script],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True
        )
        self.assertEqual(res.returncode, 0, f"Node clashExport failed: {res.stderr}")
        metrics = validate_mihomo_clash_yaml(res.stdout, "turboprobe-web clashExport.ts")
        self.assertGreaterEqual(metrics["proxies_count"], 7)
        self.assertGreaterEqual(metrics["groups_count"], 3)
        print(f"  ✓ Validated turboprobe-web/clashExport.ts: {metrics['proxies_count']} proxies, {metrics['groups_count']} groups, {metrics['rules_count']} rules")

    def test_05_worker_clash_generator(self):
        """Validate worker/index.js generateClashMetaYaml via Node execution"""
        script = f"""
import workerHandler from './worker/index.js';
const uris = {json.dumps(self.adversarial_nodes)};
const nodes = uris.map((uri, idx) => ({{ uri }}));

// Mock upstream
globalThis.fetch = async () => new Response(JSON.stringify({{ nodes }}), {{
  headers: {{ 'Content-Type': 'application/json' }}
}});

const req = new Request('https://turboprobe.workers.dev/sub?format=clash');
const res = await workerHandler.fetch(req, {{}}, {{}});
const yaml = await res.text();
console.log(yaml);
"""
        res = subprocess.run(
            ["node", "-e", script],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True
        )
        self.assertEqual(res.returncode, 0, f"Worker clash generation failed: {res.stderr}")
        metrics = validate_mihomo_clash_yaml(res.stdout, "worker/index.js")
        self.assertGreaterEqual(metrics["proxies_count"], 7)
        self.assertGreaterEqual(metrics["groups_count"], 2)
        print(f"  ✓ Validated worker/index.js: {metrics['proxies_count']} proxies, {metrics['groups_count']} groups")

    def test_06_clash_meta_500_node_scale_and_collision_stress(self):
        """Stress test 500 identical and colliding proxy names to ensure unique naming invariant"""
        duplicate_nodes = [
            "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&sni=microsoft.com&pbk=ABCD1234EFGH5678#SameTag"
            for _ in range(500)
        ]
        yaml_out = aggregator.generate_clash_meta_yaml(duplicate_nodes)
        metrics = validate_mihomo_clash_yaml(yaml_out, "500-node duplicate stress")
        self.assertEqual(metrics["proxies_count"], 500, "Must generate exactly 500 unique proxies without naming collision errors")
        print(f"  ✓ Validated 500-node duplicate collision stress: {metrics['proxies_count']} uniquely disambiguated proxies")


if __name__ == "__main__":
    unittest.main()
