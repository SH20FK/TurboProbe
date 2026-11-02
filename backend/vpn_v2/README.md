# Daily crawler / Kaggle

Requires Python 3.11+, Git, `pip install -r requirements.txt` and Internet access.
Enable notebook access to Kaggle Secrets `LATENCYLAB_API_KEY_1`,
`LATENCYLAB_API_KEY_2`, `GITHUB_TOKEN`. Environment variables with these names
also work. GitHub requires repository contents write access to SH20FK/TurboProbe.

Rolling cached verification: `python -u -m backend.vpn_v2.kaggle --cached-queue
--lab-limit 10`. It restores the saved cache without crawling and checks windows
of 1,000 keys in stable ID order. `probe-progress.json` on `crawler-state` stores
the cursor and up to 200 fresh tunnel results. Each completed window advances the
cursor; an interrupted window is retried. Further sessions resume, eventually
wrapping to a new cycle, including keys inserted before the old cursor.

Once enough winners exist, up to 10 receive LatencyLab checks and accepted nodes
are published immediately. Local checking then continues until its 4.5-hour budget
or the end of the cycle, with no more LatencyLab jobs in that run. The publication
is explicitly a top of the checked subset, not a global top of an unfinished pool.
Prior winners are reverified next run, and retained results expire after 24 hours.
No accepted nodes means the old subscription stays. Queue runs publish only small
progress/API journals instead of repeatedly uploading the large crawler snapshot.
Public labels are `TurboProbe 🇩🇪 DE` (or `TurboProbe 🌐` when unknown). URI fragments
and VMess `ps` contain only this label; Clash adds suffixes only for name collisions.
For selected nodes, country comes from verified HTTPS through the SOCKS tunnel,
Cloudflare trace with an ipwho.is fallback, not from a label or SNI.

## First full-crawler control run (maximum 10 LatencyLab jobs)

Create a private Kaggle notebook, enable Internet, leave accelerator None, and
run this complete cell. The output may contain public proxy credentials, so
keep notebook outputs private. Tokens are not printed or passed as CLI arguments.

```python
import os
import pathlib
import subprocess
import sys
from kaggle_secrets import UserSecretsClient

repo = pathlib.Path('/kaggle/working/TurboProbe')
secrets = UserSecretsClient()
for name in ('LATENCYLAB_API_KEY_1', 'LATENCYLAB_API_KEY_2', 'GITHUB_TOKEN'):
    value = secrets.get_secret(name).strip()
    if not value:
        raise RuntimeError(f'Missing secret: {name}')
    os.environ[name] = value
if not repo.exists():
    subprocess.run(['git', 'clone', '--depth', '1',
                    'https://github.com/SH20FK/TurboProbe.git', str(repo)], check=True)
else:
    subprocess.run(['git', '-C', str(repo), 'pull', '--ff-only', 'origin', 'main'], check=True)
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q',
                '-r', str(repo / 'requirements.txt')], check=True)
subprocess.run([sys.executable, '-u', '-m', 'backend.vpn_v2.kaggle',
                '--production', '--lab-limit', '10'], cwd=repo, check=True)
```

This runs full discovery and the complete eligible source pool; only the final
LatencyLab selection is limited to ten. It can publish subscriptions after a
complete successful run. It does not configure a Kaggle account schedule.

After reviewing timing, source errors, local coverage and actual API quota cost,
the daily command is `python -u -m backend.vpn_v2.kaggle --production` (up to 200
LatencyLab checks). Schedule once daily after 00:00 UTC. Set GitHub repository
variable `VPN_RUNNER=kaggle` to suspend legacy VPN Actions at cutover; Telegram
and the independent one-hour Intersvyaz profile remain separate. Only one Kaggle
runner should run at a time; a conflicting state push fails without force push.

## Crawler behavior

- Full runs use SQLite in `.local/state/crawler.sqlite`. The old registry is
  imported once, filtered and canonically deduplicated. Daily active sources and
  due quarantine entries are attempted; ranking does not truncate the pool.
- Public branch `crawler-state` contains only filtered portable state and a small
  API job journal. It is initialized automatically; no workflows/site assets are
  placed there. Public proxy configurations and source URLs can be visible there.
  API credentials, authenticated/query-token URLs and raw HTML/API bodies are
  excluded. Unknown query parameters are conservatively rejected.
  Checkpoints stream into gzip parts with at most 16 MiB of JSON each, with
  checksums and transactional restore. The whole JSON is never held in memory.
  Old single-file checkpoints migrate automatically, including those above
  the former 100 MiB restore limit. A checkpoint log confirms a successful push;
  merely having a SQLite file under `/kaggle/working` is not a remote backup.
  Prepared public archives also remain in `.local/state/public-checkpoint/`
  when a push fails. Transport failures receive bounded retries with HTTP/1.1;
  Git diagnostics are redacted. Conflicts never trigger a force push, and an
  exit-checkpoint error does not hide an earlier collection/probe exception.
- GitHub discovery covers protocol topics, names/descriptions/README, several
  languages, paginated results and recursive/non-recursive tree traversal. Search
  is date-partitioned and its unfinished queue persists across sessions. Secondary
  forges use bounded fallback paths and the common downloader. Discovery has a
  30-minute budget (10 minutes of search); API limits/incomplete results are
  reported, never described as exhaustive coverage of the internet.
- Downloads have verified TLS, public-IP pinning, up to three guarded HTTPS
  redirects, 24–64 workers depending on available CPUs, at most two requests per host, retry/backoff and a 4 MiB
  body limit. Unsupported/compressed bodies are reported, not silently parsed.
- The download queue schedules hosts fairly before occupying threads. Only a
  bounded number of response bodies can be waiting for parsing; it never submits
  the whole registry to the executor. The in-memory mirror cache is limited to
  8 MiB/128 entries. Evicted mirrors may be parsed again without losing keys.
- ETag/Last-Modified and normalized key caches survive
  sessions. A 304 reuses keys but every eligible key still undergoes current
  tunnel verification. A 304 does not rewrite node/provenance rows in SQLite;
  changed sources use bulk inserts. Mirrors retain provenance but keys are tested only once.
- The TCP prefilter shares DNS and endpoint results within a run, tries up to
  four public addresses per hostname and never uses TCP success to verify UDP
  protocols. At most 128 endpoint workers are created, instead of a Task per key.
  Each distinct proxy configuration still receives its own tunnel test.
- Tunnel verification uses 2–8 core workers with batches of 16 (up to 128 tunnels
  concurrently by default). CPU affinity and cgroup-v2 quotas constrain automatic
  sizing. `--download-workers 1..64`, `--probe-workers 1..8` and
  `--probe-batch-size 1..32` override the standalone `backend.vpn_v2` CLI.
  Core batches are submitted lazily. Two failed HTTPS targets immediately reject
  a node that cannot pass the unchanged 2-of-3 gate; successful nodes still need
  the full transfer. GitHub API requests and LatencyLab jobs remain sequential.
- Logs show the known queue size and throughput. Final crawler metrics separate
  parsing, storage and aggregate download work (download work overlaps in time).
  These metrics do not guarantee that an arbitrary pool fits the six-hour budget.
- Selected speed measurements reuse up to 12 core listeners per batch. Downloads
  remain sequential to avoid measuring competition between our own speed tests.
  Measurement callbacks are scoped to the invocation without global monkeypatching.
- Supported URI parameters are preserved. Broad search terms can find projects
  for protocols not yet supported by the checker; this does not imply support.
- After three substantive failures a source is quarantined for 1/3/7 days.
  Rate limits, platform errors and challenge pages do not add dead-source strikes.
  Quality uses smoothed fractional credit for unique working tunnels, duplicates
  and download cost. Telegram publication dates, first observation and source
  observation times are separate; a key without a publication date is not called new.

## Deadlines, failures and rollback

The whole cycle has a six-hour watchdog; local discovery/collection/verification
must finish within 4.5 hours, leaving 90 minutes for speed/API/publication. An
incomplete local pool is never published as a complete top-200. SQLite checkpoints
survive phase failures and the state branch is saved on orderly exit. Abrupt
session termination can lose work since the last remote checkpoint.

API POST submission intent and accepted request ID are journaled before further
requests. Restart polls known pending jobs. An ambiguous POST is not resubmitted;
if no matching active job can be established, the run stops for inspection. Do
not erase the journal just to retry. Polling cost must be measured in the first
live run. Quota exhaustion, agent errors or a deadline preserve the old public
subscription, rather than publishing an unfinished API selection.

Reports under `.local`: `*-candidates.json`, the final report, `*-failed.json`
for API errors, `*-incomplete.json` for time budget exhaustion. Failed runs return
nonzero. Public artifacts are generated in an isolated main-branch checkout;
only VPN files are staged. Per-file replacements are atomic; a Git commit is the
complete publication unit. Updated Worker source must be deployed separately
for 24-hour LatencyLab expiry. Static TXT/YAML cannot revoke themselves offline.

To roll back code without deleting state or rewriting Git history:

```sh
git fetch origin d644574ce5571ea52d969876044c3e6a2ae1c30f
git switch --detach d644574ce5571ea52d969876044c3e6a2ae1c30f
```

The prior runner ignores `crawler-state`; keep it for recovery. To return to
current code: `git switch main` then `git pull --ff-only`. To restore legacy VPN
Actions, clear `VPN_RUNNER`. Never force-push the subscription or state branches.

Local checks: `python -m unittest discover -s tests` and
`node --test tests/test_ru_worker.mjs`. Legacy parsers/core adapters are still
dependencies and must not be deleted before they are replaced.
