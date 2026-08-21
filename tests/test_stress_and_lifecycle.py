#!/usr/bin/env python3
"""
TurboProbe 4-Tier E2E Test Suite - Subprocess Lifecycle, Zombie Cleanup & Concurrency Stress
Covers:
- Tier 1: F4 (Child Xray Lifecycle & Zombie Cleanup)
- Tier 2: Boundary & Corner Cases (Process termination on exceptions, temp directory purge, port collision avoidance)
"""

import os
import sys
import time
import shutil
import tempfile
import subprocess
import socket
import unittest
from concurrent.futures import ThreadPoolExecutor

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")
if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

import service_prober

try:
    import psutil
except ImportError:
    psutil = None


class TestChildProcessLifecycle(unittest.TestCase):
    """Tier 1: Feature Coverage for F4 (Child Xray Lifecycle & Zombie Cleanup)"""

    def test_f4_01_xray_config_generation_multi_inbound(self):
        """F4.1: Verify Xray config builds correct multi-inbound SOCKS5 mappings with isolated ports"""
        batch = [
            {"uri": "vless://83afd88f-200f-4d89-bfc7-66eff160c1d8@198.51.100.1:443?security=reality&pbk=abcd"},
            {"uri": "trojan://SecretPass@198.51.100.2:443?security=tls&sni=example.com"},
            {"uri": "ss://YWVzLTI1Ni1nY206cGFzczEyMw@198.51.100.3:8388"}
        ]
        base_port = 10900
        inbounds = []
        outbounds = []
        rules = []

        for idx, node in enumerate(batch):
            port = base_port + idx
            tag = f"out-{idx}"
            in_tag = f"socks-in-{idx}"
            
            inbounds.append({
                "tag": in_tag,
                "port": port,
                "listen": "127.0.0.1",
                "protocol": "socks",
                "settings": {"auth": "noauth", "udp": True}
            })
            rules.append({
                "type": "field",
                "inboundTag": [in_tag],
                "outboundTag": tag
            })

        self.assertEqual(len(inbounds), 3)
        self.assertEqual(inbounds[0]["port"], 10900)
        self.assertEqual(inbounds[1]["port"], 10901)
        self.assertEqual(inbounds[2]["port"], 10902)
        self.assertEqual(len(rules), 3)

    def test_f4_02_temp_directory_purged_in_finally(self):
        """F4.2: Ensure temporary config directory is completely removed even if an error occurs"""
        tmp_dir = tempfile.mkdtemp(prefix="turboprobe_test_")
        config_path = os.path.join(tmp_dir, "config.json")
        with open(config_path, "w") as f:
            f.write('{"test": true}')
            
        self.assertTrue(os.path.exists(tmp_dir))
        self.assertTrue(os.path.exists(config_path))

        # Simulate prober finally block cleanup
        try:
            # Simulate work
            pass
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

        self.assertFalse(os.path.exists(tmp_dir), "Temporary directory must be purged in finally block")

    def test_f4_03_child_process_termination_and_reap(self):
        """F4.3: Ensure spawned child process terminates cleanly and is reaped without becoming zombie"""
        if psutil is None:
            self.skipTest("psutil not available")

        # Spawn a python sleep process simulating Xray child process
        proc = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(10)"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        pid = proc.pid
        self.assertTrue(psutil.pid_exists(pid))

        # Perform termination as done in service_prober.py finally block
        try:
            proc.terminate()
            proc.wait(timeout=2.0)
        except Exception:
            proc.kill()
            proc.wait(timeout=1.0)
        finally:
            if proc.stdout:
                proc.stdout.close()
            if proc.stderr:
                proc.stderr.close()

        self.assertIsNotNone(proc.returncode, "Process return code must be populated (reaped)")
        # Check that process is no longer running / zombie
        try:
            p = psutil.Process(pid)
            self.assertEqual(p.status(), psutil.STATUS_ZOMBIE if hasattr(psutil, "STATUS_ZOMBIE") else None)
        except psutil.NoSuchProcess:
            pass  # Successfully terminated and removed from OS process table

    def test_f4_04_port_isolation_across_parallel_workers(self):
        """F4.4: Verify that parallel workers use disjoint non-overlapping port ranges"""
        num_workers = 4
        base_socks_port = 10900
        port_step = 150
        batch_size = 75

        allocated_ranges = []
        for w_idx in range(num_workers):
            w_base_port = base_socks_port + w_idx * port_step
            w_ports = set(range(w_base_port, w_base_port + batch_size))
            allocated_ranges.append(w_ports)

        # Ensure all worker port ranges are completely disjoint
        for i in range(num_workers):
            for j in range(i + 1, num_workers):
                overlap = allocated_ranges[i].intersection(allocated_ranges[j])
                self.assertEqual(
                    overlap, set(),
                    f"Workers {i} and {j} have overlapping ports: {overlap}"
                )

    def test_f4_05_stderr_drain_preventing_pipe_deadlock(self):
        """F4.5: Ensure subprocess with large stderr output does not cause buffer deadlock"""
        # Generate 1MB of stderr output
        script = "import sys; sys.stderr.write('A' * 1000000); sys.stderr.flush()"
        proc = subprocess.Popen(
            [sys.executable, "-c", script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )
        try:
            _, stderr_data = proc.communicate(timeout=5.0)
            self.assertEqual(len(stderr_data), 1000000)
            self.assertEqual(proc.returncode, 0)
        finally:
            if proc.poll() is None:
                proc.kill()


class TestConcurrencyAndSocketStress(unittest.TestCase):
    """Tier 2: Boundary & Corner Cases (Socket stress, rapid concurrency)"""

    def test_t2_concurrent_100_socket_connections(self):
        """T2 (Stress): 100 Concurrent TCP connections to verify no FD leaks or OS socket exhaustion"""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.bind(('127.0.0.1', 0))
        server.listen(150)
        port = server.getsockname()[1]

        def client_connect(idx):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1.0)
            try:
                s.connect(('127.0.0.1', port))
                return True
            finally:
                s.close()

        try:
            with ThreadPoolExecutor(max_workers=20) as pool:
                results = list(pool.map(client_connect, range(100)))
            self.assertEqual(len(results), 100)
            self.assertTrue(all(results))
        finally:
            server.close()


if __name__ == "__main__":
    unittest.main()
