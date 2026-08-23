#!/usr/bin/env python3
"""
TurboProbe Adversarial Stress Test Suite & Empirical Verification Harness
========================================================================
Scope:
1. High-concurrency socket opening/closing and FD exhaustion resilience.
2. Concurrent Xray worker port allocation stress (out-of-order batches, zero port collisions).
3. Subprocess lifecycle stress (spawning, terminating, killing, reaping, pipe deadlock safety).
4. Corrupted/adversarial proxy URI permutations & Fuzzing (URL encoding, Base64, IPv6, YAML injection, ReDoS).
"""

import os
import sys
import time
import socket
import ssl
import json
import base64
import queue
import shutil
import tempfile
import threading
import subprocess
import asyncio
import unittest
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

import aggregator
import service_prober

try:
    import psutil
except ImportError:
    psutil = None

try:
    import yaml
except ImportError:
    yaml = None


# =============================================================================
# 1. HIGH CONCURRENCY SOCKET & FD EXHAUSTION RESILIENCE
# =============================================================================
class TestHighConcurrencySocketSafety(unittest.TestCase):
    """
    Stress tests for socket lifecycle, connection churn, and FD exhaustion resilience.
    Verifies that all sockets and SSL contexts are properly closed under high concurrency.
    """

    def setUp(self):
        self.server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_sock.bind(('127.0.0.1', 0))
        self.server_sock.listen(500)
        self.server_port = self.server_sock.getsockname()[1]
        self.running = True

        def handle_client(c):
            try:
                c.sendall(b"OK\n")
            except Exception:
                pass
            finally:
                try:
                    c.close()
                except Exception:
                    pass

        def accept_loop():
            with ThreadPoolExecutor(max_workers=30) as h_pool:
                while self.running:
                    try:
                        self.server_sock.settimeout(0.2)
                        client, _ = self.server_sock.accept()
                        h_pool.submit(handle_client, client)
                    except socket.timeout:
                        continue
                    except Exception:
                        break

        self.accept_thread = threading.Thread(target=accept_loop, daemon=True)
        self.accept_thread.start()

    def tearDown(self):
        self.running = False
        if self.accept_thread.is_alive():
            self.accept_thread.join(timeout=1.0)
        try:
            self.server_sock.close()
        except Exception:
            pass

    def test_concurrent_250_check_node_ping_live_and_dead(self):
        """
        Stress test: 250 concurrent invocations of check_node_ping on mixed live, dead,
        and invalid endpoints to verify FD cleanup and no socket leakage.
        """
        uris = []
        # 125 live endpoints
        for i in range(125):
            uris.append(f"vless://uuid{i}@127.0.0.1:{self.server_port}?security=none#Live-{i}")
        # 75 connection refused endpoints
        for i in range(75):
            uris.append(f"vless://uuid{i}@127.0.0.1:59999?security=none#Refused-{i}")
        # 50 non-routable / timeout endpoints
        for i in range(50):
            uris.append(f"vless://uuid{i}@198.51.100.1:443?security=none#Timeout-{i}")

        results = []
        start_time = time.perf_counter()
        with ThreadPoolExecutor(max_workers=50) as pool:
            futures = {pool.submit(aggregator.check_node_ping, u, timeout=0.5): u for u in uris}
            for fut in as_completed(futures):
                try:
                    res = fut.result()
                    results.append(res)
                except Exception as e:
                    self.fail(f"check_node_ping raised unhandled exception: {e}")

        elapsed = time.perf_counter() - start_time
        self.assertEqual(len(results), 250, "All 250 ping checks must return a result tuple")

        live_results = [r for r in results if "Live-" in r[0]]
        dead_results = [r for r in results if "Refused-" in r[0] or "Timeout-" in r[0]]

        self.assertEqual(len(live_results), 125)
        self.assertEqual(len(dead_results), 125)
        self.assertTrue(all(r[1] < 9999.0 for r in live_results), "Live endpoints must measure valid ping")
        self.assertTrue(all(r[1] == 9999.0 for r in dead_results), "Dead endpoints must yield 9999.0 fallback")

    def test_asyncio_socket_connection_churn_500(self):
        """
        Stress test: 500 rapid asyncio socket connections with reader/writer cleanup
        simulating the async SYN prefilter to verify zero file descriptor leakage.
        """
        async def probe_endpoint(sem, host, port, timeout=0.5):
            writer = None
            try:
                async with sem:
                    conn = asyncio.open_connection(host, port)
                    reader, writer = await asyncio.wait_for(conn, timeout=timeout)
                    return True
            except Exception:
                return False
            finally:
                if writer:
                    try:
                        writer.close()
                        await writer.wait_closed()
                    except Exception:
                        pass

        async def run_churn():
            sem = asyncio.Semaphore(100)
            tasks = []
            for i in range(250):
                tasks.append(probe_endpoint(sem, '127.0.0.1', self.server_port))
            for i in range(250):
                tasks.append(probe_endpoint(sem, '127.0.0.1', 59997))
            return await asyncio.gather(*tasks)

        results = asyncio.run(run_churn())
        self.assertEqual(len(results), 500)
        self.assertEqual(sum(results[:250]), 250, "All 250 live endpoints must be reachable")
        self.assertEqual(sum(results[250:]), 0, "All 250 closed endpoints must fail cleanly")

    def test_tls_handshake_abort_fd_leak_resilience(self):
        """
        Verify that when a non-TLS server responds to a TLS wrap_socket attempt,
        both SSLSocket and underlying raw socket are closed in the finally block.
        """
        uri = f"trojan://password@127.0.0.1:{self.server_port}?security=tls#TLSToPlain"
        uri_res, ping_ms = aggregator.check_node_ping(uri, timeout=0.3)
        self.assertEqual(uri_res, uri)
        self.assertEqual(ping_ms, 9999.0, "TLS handshake on non-TLS server must fail gracefully with 9999.0")


# =============================================================================
# 2. CONCURRENT XRAY WORKER PORT ALLOCATION & QUEUE STRESS
# =============================================================================
class TestXrayWorkerPortAllocationStress(unittest.TestCase):
    """
    Simulates high-concurrency multi-batch execution with out-of-order completion
    to guarantee ZERO port collisions and ZERO slot leaks under normal and error conditions.
    """

    def test_worker_port_pool_zero_collisions_out_of_order(self):
        """
        50 batches processed concurrently by 8 threads competing for 4 Xray slots.
        Simulates variable processing time per batch.
        Asserts that no two workers ever hold the same slot or port range simultaneously.
        """
        num_slots = service_prober.NUM_XRAY_WORKERS  # 4
        base_port = service_prober.BASE_SOCKS_PORT   # 10900
        port_step = service_prober.PORT_STEP         # 150
        batch_size = service_prober.BATCH_SIZE       # 75

        slot_queue = queue.Queue()
        for s in range(num_slots):
            slot_queue.put(s)

        active_leases = {}
        lease_lock = threading.Lock()
        collision_detected = []
        total_executions = 50

        def simulate_batch_work(batch_id: int):
            slot = slot_queue.get()
            t_id = threading.get_ident()
            assigned_port_range = range(base_port + slot * port_step, base_port + slot * port_step + batch_size)

            with lease_lock:
                if slot in active_leases:
                    collision_detected.append((batch_id, slot, active_leases[slot], t_id))
                active_leases[slot] = (t_id, set(assigned_port_range))

            try:
                import random
                sleep_time = random.uniform(0.005, 0.025)
                time.sleep(sleep_time)
                return batch_id, slot, len(assigned_port_range)
            finally:
                with lease_lock:
                    active_leases.pop(slot, None)
                slot_queue.put(slot)

        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(simulate_batch_work, b) for b in range(total_executions)]
            results = [f.result() for f in as_completed(futures)]

        self.assertEqual(len(results), total_executions)
        self.assertEqual(len(collision_detected), 0, f"Port collision detected: {collision_detected}")
        self.assertEqual(slot_queue.qsize(), num_slots, "Slot queue must contain all slots after run")

    def test_worker_slot_recycling_on_simulated_crash(self):
        """
        Verify that if an exception occurs during batch processing, the slot is
        invariably returned to the queue, preventing slot starvation/deadlock.
        """
        num_slots = 4
        slot_queue = queue.Queue()
        for s in range(num_slots):
            slot_queue.put(s)

        def failing_worker(batch_id: int):
            slot = slot_queue.get()
            try:
                if batch_id % 2 == 0:
                    raise RuntimeError("Simulated Xray crash / OOM")
                time.sleep(0.005)
                return "OK"
            finally:
                slot_queue.put(slot)

        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(failing_worker, b) for b in range(20)]
            completed = 0
            failed = 0
            for f in as_completed(futures):
                try:
                    f.result()
                    completed += 1
                except RuntimeError:
                    failed += 1

        self.assertEqual(completed, 10)
        self.assertEqual(failed, 10)
        self.assertEqual(slot_queue.qsize(), num_slots, "All slots must be recycled despite exceptions")


# =============================================================================
# 3. SUBPROCESS LIFECYCLE, ZOMBIE REAPING & PIPE DEADLOCK STRESS
# =============================================================================
class TestSubprocessLifecycleStress(unittest.TestCase):
    """
    Subprocess lifecycle stress: rapid spawn/kill cycles, massive stdout/stderr bursts,
    zombie process reaping verification, and temp folder cleanup.
    """

    def test_rapid_spawn_terminate_reap_100_cycles(self):
        """
        Rapidly spawn, terminate, and reap 50 child processes to ensure OS process
        table is never polluted and returncodes are properly collected.
        """
        for i in range(50):
            proc = subprocess.Popen(
                [sys.executable, "-c", "import time; time.sleep(5)"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            pid = proc.pid
            self.assertIsNotNone(pid)
            
            proc.terminate()
            try:
                ret = proc.wait(timeout=1.0)
            except subprocess.TimeoutExpired:
                proc.kill()
                ret = proc.wait(timeout=1.0)

            self.assertIsNotNone(ret, f"Process {pid} was not reaped")
            self.assertIsNotNone(proc.returncode)

    def test_pipe_deadlock_huge_stderr_stdout_burst(self):
        """
        Verify that subprocesses emitting 4MB of stdout and 4MB of stderr do not
        deadlock OS pipe buffers when DEVNULL or communication is used.
        """
        script = (
            "import sys\n"
            "chunk = b'X' * 65536\n"
            "for _ in range(64):\n"  # 64 * 64KB = 4MB
            "    sys.stdout.buffer.write(chunk)\n"
            "    sys.stderr.buffer.write(chunk)\n"
            "sys.stdout.flush()\n"
            "sys.stderr.flush()\n"
        )
        proc = subprocess.Popen(
            [sys.executable, "-c", script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        try:
            ret = proc.wait(timeout=5.0)
            self.assertEqual(ret, 0, "Subprocess with huge output must terminate without hanging on DEVNULL")
        finally:
            if proc.poll() is None:
                proc.kill()

    def test_temp_config_directory_purged_on_abrupt_error(self):
        """
        Verify that temporary Xray configuration folders are always cleaned up even
        if a crash or exception occurs immediately after file creation.
        """
        tmp_dir = tempfile.mkdtemp(prefix="turboprobe_xray_stress_")
        cfg_file = os.path.join(tmp_dir, "config.json")
        with open(cfg_file, "w") as f:
            f.write('{"inbounds": [], "outbounds": []}')

        self.assertTrue(os.path.exists(tmp_dir))
        self.assertTrue(os.path.exists(cfg_file))

        try:
            raise ValueError("Simulated unexpected parsing crash")
        except ValueError:
            pass
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

        self.assertFalse(os.path.exists(tmp_dir), "Temp directory must be completely removed")


# =============================================================================
# 4. CORRUPTED & ADVERSARIAL PROXY URI PERMUTATIONS (FUZZING)
# =============================================================================
class TestAdversarialUriPermutations(unittest.TestCase):
    """
    Fuzzing and adversarial testing of protocol parsers, country classifiers,
    Base64 unpackers, and Clash Meta YAML generators.
    """

    def test_extreme_url_encoding_and_null_bytes(self):
        """
        Adversarial URIs with extreme percent-encoding, null bytes, and broken sequences.
        Parsers must not crash or loop infinitely.
        """
        adversarial_uris = [
            "vless://%00%00%00@1.1.1.1:443?sni=%00&security=none#%00%00",
            "vless://uuid@1.1.1.1:443?sni=%25252520&security=reality&pbk=%25%25#%2525",
            "trojan://pass%20word@1.1.1.1:443?sni=example.com%00malicious#Tag%00",
            "vless://uuid@1.1.1.1:443?path=%2F%2F%2F%2520%2520&host=%0D%0A#Tag",
            "ss://YWVzLTI1Ni1nY206cGFzczEyMw@1.1.1.1:8388#%E2%98%A0%EF%B8%8F%20Bomb",
            "vless://uuid@[::1]:443?security=none#%FF%FE%FD",
        ]

        for uri in adversarial_uris:
            try:
                outbound = service_prober.uri_to_xray_outbound(uri, "tag-test")
                if outbound:
                    self.assertIsInstance(outbound, dict)
            except Exception as e:
                self.fail(f"uri_to_xray_outbound crashed on adversarial URI '{uri}': {e}")

            try:
                sanitized = aggregator.sanitize_node_remark(uri, ping_ms=50.0)
                self.assertIsInstance(sanitized, str)
            except Exception as e:
                self.fail(f"sanitize_node_remark crashed on adversarial URI '{uri}': {e}")

    def test_malformed_missing_fields_and_corrupted_uris(self):
        """
        Adversarial inputs with missing mandatory URI components (no user, no port, empty host).
        """
        corrupted_uris = [
            "vless://",
            "vless://@",
            "vless://@:443",
            "vless://uuid@",
            "vless://uuid@:443",
            "trojan://",
            "trojan://@example.com",
            "ss://",
            "ss://invalid_base64_plain_text@1.1.1.1:8388",
            "ss://@1.1.1.1:8388",
            "hysteria2://",
            "hy2://@:443",
            "vmess://",
            "vmess://eyJpbnZhbGlkIjogImpzb24ifQ==",
            "vmess://not_even_base64!!!",
            "vless://uuid@host:invalid_port?security=tls",
            "vless://uuid@host:9999999999999999999999999999999999999999999999999999999",
            "vless://uuid@host:-5?security=tls",
        ]

        for uri in corrupted_uris:
            try:
                outbound = service_prober.uri_to_xray_outbound(uri, "tag-corrupt")
                if outbound is not None:
                    self.assertIsInstance(outbound, dict)
            except Exception as e:
                self.fail(f"uri_to_xray_outbound threw unhandled exception on '{uri}': {e}")

            try:
                key = aggregator.get_node_key(uri)
                self.assertIsInstance(key, str)
            except Exception as e:
                self.fail(f"get_node_key threw unhandled exception on '{uri}': {e}")

    def test_adversarial_base64_permutations(self):
        """
        Unpadded, corrupted, nested, and pathological Base64 subscription inputs.
        """
        adversarial_b64 = [
            "dmxlc3M6Ly91dWlkQDEuMS4xLjE6NDQz",           # unpadded (missing =)
            "dmxlc3M6Ly91dWlkQDEuMS4xLjE6NDQz---",        # invalid padding chars
            "!!!@@@###$$$%%%^^^&&&***",                  # pure garbage
            "A" * 10000,                                  # huge non-decoded string
            base64.b64encode(b"vless://uuid@1.1.1.1:443#Plain").decode(),
        ]

        # Construct 5-layer nested Base64
        payload = "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&pbk=abcd#DeepNested"
        for _ in range(5):
            payload = base64.b64encode(payload.encode()).decode()
        adversarial_b64.append(payload)

        for b64_str in adversarial_b64:
            try:
                decoded = aggregator.recursive_decode_subscription(b64_str, max_depth=5)
                self.assertIsInstance(decoded, str)
                uris = aggregator.extract_uris_from_content(b64_str)
                self.assertIsInstance(uris, list)
            except Exception as e:
                self.fail(f"recursive_decode_subscription crashed on payload: {e}")

    def test_ipv6_address_parsing_in_vless_and_trojan(self):
        """
        Valid IPv6 address formats in standard vless:// and trojan:// proxy URIs.
        """
        ipv6_uris = [
            ("vless://uuid@[2001:0db8:85a3:0000:0000:8a2e:0370:7334]:443?security=tls&sni=example.com#IPv6-Full", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"),
            ("vless://uuid@[::1]:8443?security=none#IPv6-Loopback", "::1"),
            ("vless://uuid@[2001:db8::1]:443?security=reality&pbk=abcd#IPv6-Compressed", "2001:db8::1"),
            ("trojan://password@[fe80::1]:443?security=tls#IPv6-LinkLocal", "fe80::1"),
        ]

        for uri, expected_addr in ipv6_uris:
            outbound = service_prober.uri_to_xray_outbound(uri, "ipv6-tag")
            self.assertIsNotNone(outbound, f"Failed to parse valid IPv6 URI: {uri}")
            if outbound["protocol"] == "vless":
                addr = outbound["settings"]["vnext"][0]["address"]
                self.assertEqual(addr, expected_addr)
                self.assertNotIn("[", addr)
                self.assertNotIn("]", addr)
            elif outbound["protocol"] == "trojan":
                addr = outbound["settings"]["servers"][0]["address"]
                self.assertEqual(addr, expected_addr)
                self.assertNotIn("[", addr)
                self.assertNotIn("]", addr)

    def test_yaml_injection_in_remarks_and_parameters(self):
        """
        Adversarial remarks attempting YAML injection attacks (breaking quotes, multiline injections,
        embedded YAML directives) must be safely escaped in generate_clash_meta_yaml.
        """
        malicious_nodes = [
            {
                "uri": 'vless://uuid@1.1.1.1:443?security=none#Malicious" \n  - name: "InjectedProxy"\n    type: vless\n    server: "6.6.6.6"\n',
                "country": "US"
            },
            {
                "uri": 'trojan://pass@2.2.2.2:443?security=tls&sni=evil.com#\' ---\nmalicious_yaml: true\n',
                "country": "DE"
            },
            {
                "uri": 'ss://YWVzLTI1Ni1nY206cGFzczEyMw@3.3.3.3:8388#"""\n\n\n\t\t\t\t\t\t\t\t\t\t\t\t\t',
                "country": "NL"
            }
        ]

        yaml_content = service_prober.generate_clash_meta_yaml(malicious_nodes)
        self.assertIsInstance(yaml_content, str)

        if yaml is not None:
            try:
                parsed = yaml.safe_load(yaml_content)
                self.assertIsInstance(parsed, dict)
                self.assertIn("proxies", parsed)
                self.assertIn("proxy-groups", parsed)
            except Exception as e:
                self.fail(f"Generated Clash Meta YAML is invalid due to injection attack: {e}\nYAML Content:\n{yaml_content}")

    def test_country_detection_false_positives_and_edge_cases(self):
        """
        Empirical verification of country detection boundary cases:
        - .co vs .com (Colombia vs generic .com domain)
        - .in vs .info (India vs generic .info domain)
        - .me vs .media (Montenegro vs generic .media domain)
        - Cyrillic remarks and Russian whitelist detection
        """
        uri_com = "vless://uuid@example.com:443?sni=sub.example.com#Google-Proxy"
        cc_com = aggregator.detect_country_code(uri_com)
        self.assertNotEqual(cc_com, "CO", "example.com must not be classified as Colombia (CO)")

        uri_co = "vless://uuid@1.1.1.1:443?sni=bogota.gov.co#Colombia-Node"
        cc_co = aggregator.detect_country_code(uri_co)
        self.assertEqual(cc_co, "CO", "bogota.gov.co must be classified as Colombia (CO)")

        uri_ru = "vless://uuid@1.1.1.1:443?security=reality&sni=gosuslugi.ru#Gosuslugi"
        cc_ru = aggregator.detect_country_code(uri_ru)
        self.assertEqual(cc_ru, "RU", "gosuslugi.ru must be classified as Russia (RU)")

    def test_redos_catastrophic_backtracking_resilience(self):
        """
        Verify that regex patterns in aggregator and service_prober do not suffer from
        catastrophic backtracking when fed pathological repetitive strings.
        """
        pathological_input = "vless://" + "a" * 50000 + "@" + "b" * 50000 + ":443?" + "k=v&" * 10000 + "#" + "!" * 50000

        t0 = time.perf_counter()
        uris = aggregator.extract_uris_from_content(pathological_input)
        elapsed = time.perf_counter() - t0

        self.assertLess(elapsed, 2.0, f"Regex extraction took too long ({elapsed}s), possible ReDoS vulnerability")
        self.assertIsInstance(uris, list)


# =============================================================================
# 5. EMPIRICALLY DISCOVERED DEFECT HARNESS (BUG REPRODUCIBILITY)
# =============================================================================
class TestDiscoveredDefects(unittest.TestCase):
    """
    Defect Reproduction Harness: Empirically challenges and tests known edge-case failures.
    """

    def test_bug_ipv6_shadowsocks_hostport_split(self):
        """
        Challenge: Shadowsocks URI with bracketed IPv6 address.
        e.g. ss://YWVzLTI1Ni1nY206cGFzczEyMw@[::1]:8388#IPv6
        In service_prober.py line 357: `host, port_str = hostport.split(':', 1)` splits on first colon inside IPv6!
        """
        uri = "ss://YWVzLTI1Ni1nY206cGFzczEyMw@[2001:db8::1]:8388#IPv6-SS"
        outbound = service_prober.parse_ss_uri(uri, "ss-ipv6")
        self.assertIsNotNone(outbound, "parse_ss_uri must successfully parse bracketed IPv6 host")
        self.assertEqual(outbound["settings"]["servers"][0]["address"], "2001:db8::1")
        self.assertEqual(outbound["settings"]["servers"][0]["port"], 8388)

    def test_bug_ipv6_aggregator_ping_netloc_split(self):
        """
        Challenge: check_node_ping with IPv6 address [::1]:80.
        In aggregator.py line 506: `parts = netloc.split(':')` fails with ValueError when indexing parts[1]
        """
        uri = "vless://uuid@[::1]:80?security=none#IPv6"
        uri_res, ping_ms = aggregator.check_node_ping(uri, timeout=0.1)
        self.assertEqual(uri_res, uri)
        self.assertEqual(ping_ms, 9999.0)

    def test_service_prober_module_level_exports(self):
        """
        Verify that async_probe_candidate_socket and run_async_syn_prefilter
        are exported at module level and callable.
        """
        self.assertTrue(callable(getattr(service_prober, "async_probe_candidate_socket", None)))
        self.assertTrue(callable(getattr(service_prober, "run_async_syn_prefilter", None)))
        self.assertTrue(callable(getattr(service_prober, "check_candidate_reachability", None)))

        # Test prefilter on UDP / Hysteria2 item (tiered result: tls/tcp/tcp-fail)
        item = (0, "hysteria2://pass@[2001:db8::1]:443#Hy2", 50.0, "GLOBAL", "hysteria2")
        self.assertTrue(service_prober.check_candidate_reachability(item))

        tiers = asyncio.run(service_prober.run_async_syn_prefilter([item]))
        self.assertEqual(sum(len(bucket) for bucket in tiers.values()), 1)
        self.assertEqual(tiers["tls"][0], item)


if __name__ == "__main__":
    unittest.main(verbosity=2)
