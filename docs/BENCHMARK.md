# TurboProbe v2 — baseline и методика замеров

Замеры сделаны на GitHub Actions `ubuntu-24.04` (4 vCPU) тем же воркфлоу, что и прод:
`.github/workflows/v2-bench.yml` — он **не публикует** результаты и **не пишет**
ветку `crawler-state` (`--no-publish --no-checkpoint`).

## Состав пула (ветка `crawler-state`, 2026-11-18)

`python -m backend.vpn_v2.stats` (стримит шарды, не восстанавливая SQLite):

| Показатель | Значение |
| :--- | ---: |
| Ключей в пуле | 847 049 |
| Уникальных endpoint'ов | 426 508 |
| Строк-дублей по endpoint | 420 541 (49.6%) |
| `127.0.0.1:40443` | 73 546 конфигов (8.7%) |
| Схемы | vless 494 690 · vmess 228 642 · trojan 82 939 · ss 29 061 · hysteria2 10 139 · hy2 1 404 · tuic 174 |
| Источников | 178 958 (170 231 `new`, 8 727 `active`) |
| Прогресс очереди | 252 000 обработано, cycle 1 |
| Живых в `local` | 4 062 |

## Baseline (до оптимизаций)

| Сценарий | Время | Детали |
| :--- | ---: | :--- |
| Восстановление состояния | **110–126 с** | 803.6 MiB JSON из `crawler-state` |
| Одно окно 1000 ключей | **40.9 с** | preflight 0.03 с, prefilter 10.3 с, tunnel 30.5 с |
| 10 окон подряд | **39.3 с/окно** | prefilter 8.5 с/окно, tunnel 30.8 с/окно |
| Prefilter | 802 → 269 | 33.5% проходят TCP |
| Туннели | 269 → 9 | 3.3% прошедших TCP реально работают |
| Полный проход 847k (экстраполяция) | **~9.2–9.6 ч** | 24.5 ключа/с |

Прочее из baseline:

- 10 000 проверенных ключей → 74 живых (0.74%); накопленно 252 000 → 4 062 (1.6%).
- Пакет из 32 узлов в Xray живёт ~20–27 с, поэтому пропускная способность упирается
  в «хвост» самого медленного туннеля, а не в CPU.

## Что изменено после baseline

- `node_filter.py` — отсев loopback/private/link-local, битых hostname и
  `speedtest.net`/`fast.com` на приёме в `Store.success` и внутри `probe.verify`.
  На первом же замере отброшено 365 из 5 062 ключей (7.2%).
- `run_queue` сначала перепроверяет **все** свежие живые узлы (из `progress['local']`),
  затем идёт по неизвестному пулу: подписка остаётся свежей, даже если полный обход
  ещё не закончен. Живой проход: 4 062 узла → 3 248 проверено → **1 706 живых**.
- `--sweep-seconds N` — бюджет на обход неизвестного пула за один запуск; курсор
  сохраняется. Прод-профиль: живой проход + 45 мин sweep ≈ 55 мин на запуск.
- `TP_PROBE_WORKERS` (1–16), `TP_PROBE_BATCH` (1–64), `TP_PREFILTER_CONCURRENCY`
  (32–1024) — для тюнинга без правки кода; матрица замеров идёт через `v2-bench`.

## Как повторить

```sh
# состав пула
python -m backend.vpn_v2.stats --json pool.json

# одно окно, без публикации и записи состояния
python -u -m backend.vpn_v2.cached_queue --select 0 --window 1000 \
  --max-windows 1 --budget-seconds 19800 --no-publish --no-checkpoint

# 10 окон с другими воркерами
TP_PROBE_WORKERS=16 TP_PROBE_BATCH=64 TP_PREFILTER_CONCURRENCY=512 \
  python -u -m backend.vpn_v2.cached_queue --select 0 --window 1000 \
  --max-windows 10 --budget-seconds 19800 --no-publish --no-checkpoint --skip-priority
```

Метрики по фазам печатаются как `METRICS: {...}` и пишутся в
`backend/vpn_v2/.local/metrics-last.json`.
