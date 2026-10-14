# IA#2 — Zero-downtime Migration

Student: 23120262 — Tống Dương Thái Hòa. Status: COMPLETED.

Move menu_items.price (thousands of dong, REAL) to price_vnd (dong, INTEGER). Old HTTP price and order_items.unit_price/order total retain their original unit. One continuous traffic process tests two instances on ports3001/3002 sharing data/app.db. v1 is the original starter commit2b889bd. All migration/down/rollback evidence is collected into check-log.txt and traffic-log.txt during execution.

## Steps and Compatibility

S0 = 001, legacy price. S1 = 001+002, both columns. S2 = 001+002+003, only price_vnd. Version pairs show port3001 / port3002. The rolling commands below define the exact undo for each code change.

| Step | Schema after | Instances | Undo command/action | Earlier safe versions |
|---|---|---|---|---|
| S08 baseline/seed | S0 | not started | Before traffic only: npm.cmd run migrate:down (001 deletes disposable data) | v1 |
| S09 traffic start | S0 | v1/v1 | Stop-file data/stop-traffic drains requests; ending the run cannot be undone by concatenating another log | v1, old clients |
| S10 Expand002 | S1, pending VND | v1/v1 | npm.cmd run migrate:down; npm.cmd run check -- baseline | v1/v2, legacy authoritative |
| S11 prepare/test v2 | S1 | v1/v1 | No live deployment; keep v1/v1, undo002 only while all servers v1 | v1/v2 |
| S12 tag v2 | S1 | v1/v1 | No live mutation; preserve tag for audit | v1/v2 |
| S13 deploy A v2 | S1, pending VND | v2/v1 | Rolling port3001 to v1 | v1/v2, gate off |
| S14 deploy B v2 | S1 | v2/v2 | Disable/drain gate if active; rolling3001 then3002 to v1 | v1 after drain; reconcile on forward |
| S15 pause backfill | S1, partial | v2/v2 | Stop between committed batches; keep additive values. Code can roll to v1 after drain | v1/v2; not v3/v4 yet |
| S16 resume/rerun | S1, dual consistent | v2/v2 | No data undo needed; legacy preserved. v1 rollback after drain requires later reconciliation | v1/v2; v3/v4 data-ready |
| S17 enable new clients | S1, dual consistent | v2/v2 | Remove-Item data/enable-new-clients; wait disabled + subsequent new_inflight=0 | v2; v1 after drain |
| S18 prepare/test/tag v3 | S1 | v2/v2 | No live deployment; keep v2/v2 | v2; v1 after drain |
| S19 deploy A v3 | S1, dual consistent | v3/v2 | Rolling3001 to v2, check dual | v2; v1 after drain |
| S20 deploy B v3 | S1, dual consistent | v3/v3 | Rolling3001 then3002 to v2, check dual after each | v2; v1 after drain |
| S21 rollback precheck | S1 | v3/v3 | Read-only, no mutation | v2/v3 |
| S22 rollback A | S1 | v2/v3 | Rolling3001 to v3 | v2/v3 |
| S23 rollback B | S1 | v2/v2 | Rolling3001 then3002 to v3 | v2/v3 |
| S24 forward A | S1 | v3/v2 | Rolling3001 to v2 | v2/v3 |
| S25 forward B | S1 | v3/v3 | Rolling3001 then3002 to v2 | v2/v3 |
| S26 prepare/test/tag v4 | S1, dual consistent | v3/v3 | No live deployment; keep v3/v3 | v2/v3 |
| S27 deploy first v4 — boundary | S1, legacy may stale/NULL | v4/v3 | Rolling3001 to v3; canonical check. Do not direct-rollback to v2/v1 | v3 on S1; v2 needs resync |
| S28 deploy B v4 | S1, canonical valid | v4/v4 | Rolling3001 then3002 to v3; resync before v2 | v3 on S1 |
| S29 Contract003 | S2 | v4/v4 | npm.cmd run migrate:down restores003; then coordinated recovery below | No earlier code directly on S2 |
| S30 live API probes | S2 | v4/v4 | Probe creates separate item, no schema undo | v4, old/new clients |
| S31 final tests/check | S2 | v4/v4 | Tests use isolated DB; no main DB mutation | v4 |
| S32 finish traffic | S2 | stopped after drain | Fresh process is a new run, not continuation | v4 can restart on S2 |
| S33 each down | Main S2 unchanged | stopped | Separate data/down-verify.db; Remove-Item Env:DB_PATH restores default main DB | Main compatibility unchanged |
| Final reports/commit | S2 | stopped | Correct documents with another commit; preserve raw logs/tags | As above |

## Exact Rolling Undo

Only stop the named server with Ctrl+C; wait for prompt and its traffic down event. The other server must keep serving. After the target restarts, wait back and a clean tick, check /health, then run `npm.cmd run check -- expand` (v1/v2 with pending backfill), `-- dual` (v2/v3 after backfill), or `-- canonical` (v3 after v4 writes). v1 health has no version/DB; its starter worktree commit and console show the version/shared DB.

The following are the exact start commands used by the table's rolling undo targets. They run in the stopped server's worktree, whose parent is IA#02. No function or script automatically deploys.

### v1 on port3001

```powershell
cd ..\v1
$env:DB_PATH = (Resolve-Path ..\awad-price-migration-starter\data\app.db).Path
$env:PORT = '3001'
node src/server.js
```

### v1 on port3002

```powershell
cd ..\v1
$env:DB_PATH = (Resolve-Path ..\awad-price-migration-starter\data\app.db).Path
$env:PORT = '3002'
node src/server.js
```

### v2 on port3001

```powershell
cd ..\v2
$env:DB_PATH = (Resolve-Path ..\awad-price-migration-starter\data\app.db).Path
$env:PORT = '3001'
node src/server.js
```

### v2 on port3002

```powershell
cd ..\v2
$env:DB_PATH = (Resolve-Path ..\awad-price-migration-starter\data\app.db).Path
$env:PORT = '3002'
node src/server.js
```

### v3 on port3001

```powershell
cd ..\v3
$env:DB_PATH = (Resolve-Path ..\awad-price-migration-starter\data\app.db).Path
$env:PORT = '3001'
node src/server.js
```

### v3 on port3002

```powershell
cd ..\v3
$env:DB_PATH = (Resolve-Path ..\awad-price-migration-starter\data\app.db).Path
$env:PORT = '3002'
node src/server.js
```

The actual forward starts use the identical commands with `cd ..\v3` or `cd ..\v4`. The required rollback kept new clients enabled throughout, because v2 and v3 support the same HTTP fields and dual-write.

Before returning to v1, if the gate exists:

```powershell
Remove-Item -LiteralPath .\data\enable-new-clients
```

Wait NEW_CLIENTS disabled plus a subsequent new_inflight=0 tick. Then use the v1 commands above, one instance at a time. Do not down002 while v2/v3/v4 runs. To go forward again, deploy v2/v2 and run:

```powershell
node scripts/backfill.js
npm.cmd run check -- dual
New-Item -ItemType File -Path .\data\enable-new-clients
```

Enable the gate only after the dual check passes. Keep the traffic process running.

## Point of No Return and Recovery

Named boundary: S27, first v4 enters traffic, conservatively before its first VND-only write. The promise of direct rollback to v2/v1 ends: old price may be stale or NULL even though both columns exist. v3 still reads canonical VND safely on S1. After DROP, v3 requires schema restoration first. Canonical data remains, so coordinated recovery is still possible.

After Contract: keep v4/v4 serving; verify003 is last applied; npm.cmd run migrate:down restores legacy price from price_vnd/1000.0; check canonical. Roll one instance at a time to v3; once all v4 are gone, resync legacy from canonical in short batches. Never run the legacy→VND backfill after v4-only writes.

```powershell
node --input-type=module -e 'const {open}=await import("./src/db.js");const db=open();try{const q=db.prepare("UPDATE menu_items SET price=price_vnd/1000.0 WHERE id IN (SELECT id FROM menu_items WHERE price IS NULL OR price<>price_vnd/1000.0 ORDER BY id LIMIT 500)");for(;;){db.exec("BEGIN IMMEDIATE");let n;try{n=q.run().changes;db.exec("COMMIT");}catch(e){db.exec("ROLLBACK");throw e;}console.log("restored_legacy_batch="+n);if(!n)break;await new Promise(r=>setTimeout(r,20));}}finally{db.close();}'
npm.cmd run check -- dual
```

Only dual PASS permits v2. v1 additionally needs new-client drain. Re-apply003 only with v4/v4.

## Money Policy and Harness

Old input is normalized once with Math.round(price*1000), then legacy=value/1000. Valid integer range1..100000000, zero-after-round and conflicting fields rejected. Sub-dong precision cannot be restored exactly by downSQL; starter seed/traffic use representable half-thousand prices. Orders remain in thousands.

Migration runner only fixes fileURLToPath for Windows spaces/#. Traffic preserves error/contract/stale/unavailable definitions and adds manual new-client gate, old/new success/inflight counters and stop-file drain; rerouted is not failure. Checker reads one snapshot and reports legacy discrepancies even when canonical is authoritative. Record/probe helpers remain outside this repository; no run-all script is included.

## Actual Evidence

Local execution used Windows/PowerShell7.6.6/Node24.16.0. Codex performed the authorized operations directly on main; no branch creation/switch command was issued in this execution turn. No ZIP/push/submission was performed. Earlier scratch/Linux runs are not these evidence files.

| Evidence | File and actual lines | Result |
|---|---|---|
| Baseline/tag/start | check-log.txt2–80; traffic-log.txt2 | v1=2b889bd,20000 seeded, baseline CONSISTENT, starter tests4/4 |
| Expand under v1/v1 | check-log.txt82–105 | Added002 only; v1/v1 continued serving |
| Atomic dual-write | check-log.txt236–352; v2=5559281 | v2 tests6/6, rolling A then B; legacy authoritative during mixed deployment |
| Pause/resume/rerun | check-log.txt354–462 | First1500 rows in3 committed batches; resumed18895; immediate dual CONSISTENT; rerun0 |
| New clients | traffic-log.txt29; check-log.txt464–502 | Enabled111.8s, ratio0.3, no process restart |
| Read canonical | check-log.txt545–660; v3=08e8543 | Tests6/6 and dual checks after each instance |
| Required live rollback/forward | check-log.txt662–837; traffic-log.txt52–73 | v3/v3→v2/v2→v3/v3; four down/back pairs, zero failures and dual CONSISTENT |
| Boundary/new-only writes | check-log.txt917–1015; traffic-log.txt78–93 | Firstv4 back296.3s; legacy invalid124/disagree732 observed at S27 while canonical valid |
| Contract | check-log.txt1017–1069 | Both v4 before003, applied003, no price column, contract CONSISTENT |
| Live compatibility after DROP | check-log.txt1071–1142 | Old/new POST/PATCH, detail/list, order total102 (thousands) all asserted |
| Final tests/data | check-log.txt1144–1221 | v4 tests6/6, shared DB contract CONSISTENT,36026 rows after traffic |
| Every DOWN on separate DB | check-log.txt1223–1335 | DOWN003/002/001; restored45500→45.5; isolated schema empty; main unchanged |
| Continuous traffic final | traffic-log.txt103–104 | ok793623, error0/contract0/stale0/unavailable0, rerouted1597, old_ok646726/new_ok146897, new_inflight0; process exit0 |

Traffic ran2026-10-14T12:54:25.786Z through approximately13:00:56.6Z (19:54:25.786–20:00:56.6 Asia/Saigon), duration390.8s. There is exactly one start and ten non-overlapping down/back pairs (five per port). The last migration and post-DROP verification happened before traffic stopped.

### Deviations and interpretation

- Prepared RED tests intentionally failed against the preceding implementation: check-log.txt107–234 (v2),504–543 (v3),839–878 (v4). The next GREEN suite passed6/6 each. These retained unit-test failures are not traffic failures.
- Expanded VND can be NULL/mismatched while v1 writes. After backfill all dual counts were0. At S27 legacy becomes invalid/stale; canonical checks still report those counts and require valid VND.
- Actual servers ran `node src/server.js` directly, enabling native terminal Ctrl+C; the app/shutdown handlers were unchanged.
- The existing user AI history was preserved and appended. Prepared report templates had been deleted; final reports were written from current evidence.
- A v3 tagged-source comment refers to its v2 origin; executable SQL and canonical-read tests establish the real behavior. Tags were kept immutable.
- Review is the author's self-review; no subagent or independent reviewer was used.

## Reproduce the Tagged Sequence

Use a separate directory and database for replay; preserve official logs. Existing tags contain the deployed code and the preparation commit5bee971 contains the Windows-safe runner/checker/traffic but only001.

1. From this final repository, create detached worktrees for v1/v2/v3/v4 (if absent), and `git worktree add --detach ..\replay-control 5bee971`. These commands do not create a branch.
2. In replay-control, `npm.cmd run migrate`, `npm.cmd run seed`, `npm.cmd run check -- baseline`. It has only001. Run two v1 servers in separate terminals on3001/3002, setting DB_PATH to the absolute **replay-control/data/app.db**; set PORT explicitly.
3. In replay-control, set `$env:NEW_CLIENTS='0.3'` then `npm.cmd run traffic`. Gate/stop files must initially be absent. Keep this one process running.
4. Copy the002 up/down pair from this final repository into replay-control/migrations; run `npm.cmd run migrate`, `npm.cmd run check -- expand`. Roll each server to its v2 worktree; keep the same replay DB_PATH.
5. Copy scripts/backfill.js from this repository into replay-control/scripts. With v2/v2, pause at3 batches using BACKFILL_MAX_BATCHES3, remove that env after pause, resume, immediately `npm.cmd run check -- dual`, rerun0. Create data/enable-new-clients in replay-control.
6. Roll one server at a time to v3. Check dual after each; then perform v3→v2→v3 for both instances, with dual checks before/after.
7. Roll each to v4; now canonical is authoritative. Only v4/v4 permits copying003 up/down into replay-control/migrations and `npm.cmd run migrate`; run `npm.cmd run check -- contract`.
8. Probe old/new HTTP menu/orders. Tests for the final contract schema run from this primary final repository with `npm.cmd test`; fixtures are in-memory and cannot alter either main/replay DB. Tests from v2/v3/v4 tagged worktrees cover their original schema snapshots.
9. Create replay-control/data/stop-traffic; wait FINAL/RESULT then stop servers. Replay must produce separate logs, never append a second run to the submitted traffic-log.txt.
10. In replay-control use a different DB_PATH such as down-verify.db and run all pending migrations; insert VND45500 sample, down003/dual/restored45.5, down002/baseline, down001/empty schema_migrations. Restore DB_PATH to replay's shared DB afterward.

For replay, replace the main DB path in the rolling blocks above with replay-control/data/app.db. The migration and checker commands in this document are executable from the relevant controller root; external preparation helpers are not required to replay the business operations.
