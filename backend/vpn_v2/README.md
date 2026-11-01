# VPN pipeline / Kaggle

Python 3.11+, `pip install -r requirements.txt`, internet enabled.
In Kaggle Secrets, enable access for this notebook to `LATENCYLAB_API_KEY_1`,
`LATENCYLAB_API_KEY_2` (different accounts, used in that order) and `GITHUB_TOKEN`
(repository contents write permission, production only). Environment variables
with the same names also work. Credentials are never passed as CLI arguments.

From a notebook with the repository cloned:

```python
import subprocess
subprocess.run(['python', '-m', 'backend.vpn_v2.kaggle'], cwd='/kaggle/working/TurboProbe', check=True)
```

Default test: collect 50 candidates, verify real Xray/Mihomo tunnels, select up
to 10 by HTTPS latency, measure a bounded 4 MiB download through those tunnels,
then check every selected node on all currently online LatencyLab operators.
Speed never changes ping order. Fewer than ten successes means fewer than ten
API checks. The runner installs missing cores from official GitHub releases.

Add `--production` to the command for up to 5000 candidates/top 200 and GitHub
publication. A fresh isolated checkout stages only VPN artifacts in `sub/` and
`docs/sub/`. Push conflicts are retried from fresh checkouts without force push.
Telegram and the separate Intersvyaz snapshot are preserved. API failure aborts
publication; a completed all-negative check publishes an empty snapshot.

## Two-stage test

```sh
python -m backend.vpn_v2 --out backend/vpn_v2/.local/test50.json --candidate-limit 50 --collect-only
python -m backend.vpn_v2 --from-candidates backend/vpn_v2/.local/test50-candidates.json --out backend/vpn_v2/.local/test50.json --candidate-limit 50 --select 10 --install-cores
```

If this machine cannot verify any tunnel, a separate diagnostic can still select
the fastest ten TCP-reachable candidates for an external comparison:

```sh
python -m backend.vpn_v2.smoke --latencylab
```

This diagnostic writes only a private report. TCP timings are not tunnel ping;
the diagnostic cannot publish subscriptions, even after LatencyLab success.

Private `.local` reports contain proxy credentials. Do not expose them as public
notebook outputs/artifacts. Previous reports are preserved on quota/network/job
failure. Ambiguous POSTs are not retried. Check account statistics before and
after the first live run to establish polling quota cost; daily capacity is not
guaranteed. The first account is consumed before the second is used. Production
attempts up to 200 checks per daily run. If both quotas are exhausted after some
completed checks, only successful completed checks are published; unchecked nodes
are excluded and the report records quota exhaustion. Zero available checks or
any other API/network failure preserves the previous publication.

## Cutover

Run the test in Kaggle first and review its private report. After it succeeds,
schedule one daily Kaggle run with `--production`, preferably after 00:00 UTC
(05:00 Yekaterinburg), when the LatencyLab daily quota resets. Allow time for
the run to finish before expecting the new subscription.
The runner performs one cycle; it does not configure the Kaggle account schedule.
Set GitHub repository variable `VPN_RUNNER=kaggle` to suspend the legacy VPN
Actions during cutover; Telegram is independent. Clear it for rollback.

The site and updated Worker source accept LatencyLab confirmations for at most
24 hours. Deploy the updated Worker separately. Static TXT/YAML files cannot
revoke themselves when the runner is offline: use the Worker for strict expiry.
The independent Intersvyaz profile keeps its one-hour policy.

The parser and tunnel engine still use legacy adapters in `backend/vpn`; do not
remove these files yet. New orchestration does not read old node-history JSON.
Source failures are reported by index without logging URLs/tokens. HTTPS source
redirects are currently rejected. Files are replaced atomically individually;
the Git commit is the complete publication unit.
