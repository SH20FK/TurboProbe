#!/usr/bin/env python3
"""
TurboProbe 4-Tier Opaque-Box E2E Master Test Runner
===================================================
Executes all test modules covering Tiers 1-4:
- Tier 1: Feature Coverage (at least 5 tests per feature F1..F11)
- Tier 2: Boundary & Corner Cases (at least 5 tests per feature)
- Tier 3: Cross-Feature Combinations (Pairwise interactions)
- Tier 4: Real-World Workload Scenarios (Full E2E simulations)

Usage:
  python tests/run_all_e2e.py
  python tests/run_all_e2e.py --tier 1
  python tests/run_all_e2e.py --verbose
"""

import os
import sys
import time
import argparse
import unittest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS_DIR = os.path.join(PROJECT_ROOT, "tests")
TOOLS_DIR = os.path.join(PROJECT_ROOT, "tools")

if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)
if TESTS_DIR not in sys.path:
    sys.path.insert(0, TESTS_DIR)

import test_formats
import test_backend_e2e
import test_web_and_worker
import test_stress_and_lifecycle
import test_tier3_combinations
import test_tier4_scenarios


def create_tier_suites():
    """Builds individual test suites grouped by Tier."""
    loader = unittest.TestLoader()

    tier1_suite = unittest.TestSuite()
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_formats.TestProtocolParsingAndIngestion))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_formats.TestSubscriptionDataFeedCleanliness))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_backend_e2e.TestSocketAndSessionSafety))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_backend_e2e.TestConcurrencyAndDeduplication))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_backend_e2e.TestGlobalpingAPIResilience))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_backend_e2e.TestDiscoveryAndTargetServices))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_web_and_worker.TestCloudflareWorkerEdge))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_web_and_worker.TestWebFrontendAndTypes))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_web_and_worker.TestCICDWorkflows))
    tier1_suite.addTests(loader.loadTestsFromTestCase(test_stress_and_lifecycle.TestChildProcessLifecycle))

    tier2_suite = unittest.TestSuite()
    tier2_suite.addTests(loader.loadTestsFromTestCase(test_formats.TestBoundaryAndCornerCases))
    tier2_suite.addTests(loader.loadTestsFromTestCase(test_stress_and_lifecycle.TestConcurrencyAndSocketStress))

    tier3_suite = unittest.TestSuite()
    tier3_suite.addTests(loader.loadTestsFromTestCase(test_tier3_combinations.TestTier3CrossFeatureCombinations))

    tier4_suite = unittest.TestSuite()
    tier4_suite.addTests(loader.loadTestsFromTestCase(test_tier4_scenarios.TestTier4RealWorldScenarios))

    return {
        1: ("Tier 1: Feature Coverage (F1..F11)", tier1_suite),
        2: ("Tier 2: Boundary & Corner Cases", tier2_suite),
        3: ("Tier 3: Cross-Feature Combinations", tier3_suite),
        4: ("Tier 4: Real-World Workload Scenarios", tier4_suite),
    }


def print_banner():
    print("=" * 80)
    print(" ⚡ TURBOPROBE 4-TIER E2E TEST SUITE RUNNER")
    print("=" * 80)
    print(f" Working Directory: {PROJECT_ROOT}")
    print(f" Timestamp:         {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print("=" * 80 + "\n")


def run_tests(selected_tier=None, verbosity=1):
    print_banner()
    suites_map = create_tier_suites()
    
    total_ran = 0
    total_passed = 0
    total_failed = 0
    total_errors = 0
    total_skipped = 0

    results_summary = []
    start_all_time = time.perf_counter()

    tiers_to_run = [selected_tier] if selected_tier in suites_map else [1, 2, 3, 4]

    for tier_num in tiers_to_run:
        tier_title, suite = suites_map[tier_num]
        print(f"\n▶ Running [{tier_title}] ({suite.countTestCases()} test cases)...")
        print("-" * 80)

        runner = unittest.TextTestRunner(verbosity=verbosity)
        t_start = time.perf_counter()
        result = runner.run(suite)
        t_elapsed = time.perf_counter() - t_start

        ran = result.testsRun
        failed = len(result.failures)
        errors = len(result.errors)
        skipped = len(result.skipped)
        passed = ran - failed - errors - skipped

        total_ran += ran
        total_passed += passed
        total_failed += failed
        total_errors += errors
        total_skipped += skipped

        results_summary.append({
            "tier": tier_num,
            "title": tier_title,
            "ran": ran,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "skipped": skipped,
            "time": t_elapsed
        })

    total_time = time.perf_counter() - start_all_time

    # Print Summary Matrix
    print("\n" + "=" * 80)
    print(" 📊 TEST EXECUTION SUMMARY MATRIX")
    print("=" * 80)
    print(f" {'Tier / Test Suite':<45} | {'Total':<6} | {'Pass':<6} | {'Fail':<6} | {'Error':<6} | {'Time (s)':<8}")
    print("-" * 80)

    for item in results_summary:
        print(
            f" {item['title']:<45} | {item['ran']:<6} | {item['passed']:<6} | "
            f"{item['failed']:<6} | {item['errors']:<6} | {item['time']:<8.2f}"
        )

    print("-" * 80)
    print(
        f" {'TOTAL':<45} | {total_ran:<6} | {total_passed:<6} | "
        f"{total_failed:<6} | {total_errors:<6} | {total_time:<8.2f}"
    )
    print("=" * 80)

    if total_failed == 0 and total_errors == 0:
        print("\n🎉 ALL E2E TEST TIERS COMPLETED SUCCESSFULLY (100% PASS)!\n")
        return 0
    else:
        print(f"\n⚠️ TEST SUITE COMPLETED WITH FAILURES: {total_failed} failures, {total_errors} errors.\n")
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TurboProbe 4-Tier E2E Test Runner")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4], help="Run a specific test tier only")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose test output")
    args = parser.parse_args()

    sys.exit(run_tests(selected_tier=args.tier, verbosity=2 if args.verbose else 1))
