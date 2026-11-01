import pathlib
import subprocess
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class ProjectLayoutTests(unittest.TestCase):
    def test_vpn_paths_point_to_the_repository(self):
        sys.path.insert(0, str(ROOT / 'backend' / 'vpn'))
        import aggregator
        import service_prober

        self.assertEqual(pathlib.Path(aggregator.SUB_DIR), ROOT / 'sub')
        self.assertEqual(pathlib.Path(service_prober.ROOT_DIR), ROOT)
        self.assertEqual(pathlib.Path(service_prober.TOOLS_DIR), ROOT / 'backend' / 'vpn')

    def test_telegram_workflow_imports_resolve(self):
        result = subprocess.run(
            [sys.executable, '-c', 'from backend.telegram.tg_aggregator import run_tg_harvest; from backend.telegram.exporter import export_all'],
            cwd=ROOT, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
