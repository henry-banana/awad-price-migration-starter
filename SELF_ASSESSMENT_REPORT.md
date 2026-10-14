# Self-assessment — IA#2 Zero-downtime migration

**Student ID:** 23120262  
**Full name:** Tống Dương Thái Hòa  
**Total I claim:** 100 / 100  
**Status:** Completed.  

| Criterion | Max | I claim | Evidence |
|---|---:|---:|---|
| The plan | 20 | 20 | MIGRATION.md step table, exact rolling undo, compatibility, named S27 boundary and coordinated recovery; v1=2b889bd, v2=5559281, v3=08e8543, v4=0cb5b7f. |
| Expand and dual write | 20 | 20 | migrations/002_expand_price_vnd.up.sql/down.sql; v2 src/app.js uses atomic two-column INSERT/UPDATE. check-log.txt lines 82–87; check-log.txt lines 274–293; check-log.txt lines 236–254. Every DOWN executed: check-log.txt lines1251–1321. |
| Backfill | 15 | 15 | scripts/backfill.js,500-row transactions,20ms pauses. Pause/resume: check-log.txt lines354–422 (1500 paused +18895 resumed). Immediate CONSISTENT: check-log.txt lines 424–439; idempotent rerun0: check-log.txt lines441–462. v2/v2 proven at lines313–334 before backfill. |
| Zero failed requests | 20 | 20 | traffic-log.txt lines2–104: one start, ten down/back pairs, new clients enabled30% at line29. FINAL/RESULT lines103–104:793623ok, error/contract/stale/unavailable all0; rerouted1597; old_ok646726/new_ok146897. |
| The way back | 15 | 15 | Live v3/v3→v2/v2→v3/v3; CONSISTENT before/after: check-log.txt lines662–837. Traffic stretch lines52–73 contains all four restarts with zero failure counters. MIGRATION.md explains dual-write safety and later unsafe direct rollback. |
| Contract | 10 | 10 | v4/v4 BEFORE DROP: check-log.txt lines1017–1038; applied003 and no SQL price: lines1040–1059. Live old/new POST/PATCH, list/detail/orders: lines1071–1128. Post-contract6/6: lines1144–1162; traffic remains clean through line104. |
| **Total** | **100** | **100** | 20+20+15+20+15+10=100. |

## What I Did Not Manage

All six rubric criteria have local implementation and execution evidence. This assessment has not been accepted or graded by the instructor. Student review and ZIP/submission are still pending. The run covers the starter traffic workload and targeted HTTP/database tests; it is not a proof for every possible production workload. Operational recovery beyond the named boundary is documented; the required pre-boundary rollback and all SQL downs were executed.

The supplied AI usage history is retained. The local run was assistant-executed with explicit authorization; this report does not claim independent student terminal execution.

## What I Would Do Differently

Prepare the evidence labels and version/schema matrix before starting, and keep canonical/legacy invariants explicit. The mixed v1/v2 phase legitimately leaves VND pending; only switch reads after backfill and dual CONSISTENT. Once v4 writes, never reconcile from stale legacy values. For another DB engine, evaluate its lock/DDL behavior separately rather than assuming SQLite timings transfer.

## Evidence Integrity

Logs are raw outputs collected during the same local run. Expected RED unit-test failures are labelled and retained; every GREEN suite passed. A DOWN on the separate verification DB cannot affect the shared main DB. Logs are referenced using one-based line numbers.
