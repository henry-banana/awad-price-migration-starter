# IA#2 — Zero-downtime Migration

Student: 23120262 — Tống Dương Thái Hòa. Status: IN PROGRESS, 2026-10-14 (Asia/Saigon).

Move menu_items.price (thousands of dong, REAL) to price_vnd (dong, INTEGER). Old HTTP price and order_items.unit_price/order total retain their original unit. One continuous traffic process tests two instances on ports3001/3002 sharing data/app.db. v1 is the original starter commit2b889bd. All migration/down/rollback evidence is collected into check-log.txt and traffic-log.txt during execution.

## Steps and Compatibility

S0 = 001, legacy price. S1 = 001+002, both columns. S2 = 001+002+003, only price_vnd. Version pairs show port3001 / port3002. The rolling commands below define the exact undo for each code change.

| Step | Schema after | Instances | Undo command/action | Earlier safe versions |
|---|---|---|---|---|
| S08 baseline/seed | S0 | not started | Before traffic only: npm.cmd run migrate:down (001 deletes disposable data) | v1 |
| S09 traffic start | S0 | v1/v1 | Stop-file data/stop-traffic drains requests; ending the run cannot be undone by concatenating another log | v1, old clients |
| S10 Expand002 | S1, pending VND | v1/v1 | npm.cmd run migrate:down; npm.cmd run check -- baseline | v1/v2, legacy authoritative |
| S13 deploy A v2 | S1, pending VND | v2/v1 | Rolling port3001 to v1 | v1/v2, gate off |
| S14 deploy B v2 | S1 | v2/v2 | Disable/drain gate if active; rolling3001 then3002 to v1 | v1 after drain; reconcile on forward |
| S15 pause backfill | S1, partial | v2/v2 | Stop between committed batches; keep additive values. Code can roll to v1 after drain | v1/v2; not v3/v4 yet |
| S16 resume/rerun | S1, dual consistent | v2/v2 | No data undo needed; legacy preserved. v1 rollback after drain requires later reconciliation | v1/v2; v3/v4 data-ready |
| S17 enable new clients | S1, dual consistent | v2/v2 | Remove-Item data/enable-new-clients; wait disabled + subsequent new_inflight=0 | v2; v1 after drain |
| S19 deploy A v3 | S1, dual consistent | v3/v2 | Rolling3001 to v2, check dual | v2; v1 after drain |
| S20 deploy B v3 | S1, dual consistent | v3/v3 | Rolling3001 then3002 to v2, check dual after each | v2; v1 after drain |
| S21 rollback precheck | S1 | v3/v3 | Read-only, no mutation | v2/v3 |
| S22 rollback A | S1 | v2/v3 | Rolling3001 to v3 | v2/v3 |
| S23 rollback B | S1 | v2/v2 | Rolling3001 then3002 to v3 | v2/v3 |
| S24 forward A | S1 | v3/v2 | Rolling3001 to v2 | v2/v3 |
| S25 forward B | S1 | v3/v3 | Rolling3001 then3002 to v2 | v2/v3 |
| S27 deploy first v4 — boundary | S1, legacy may stale/NULL | v4/v3 | Rolling3001 to v3; canonical check. Do not direct-rollback to v2/v1 | v3 on S1; v2 needs resync |
| S28 deploy B v4 | S1, canonical valid | v4/v4 | Rolling3001 then3002 to v3; resync before v2 | v3 on S1 |
| S29 Contract003 | S2 | v4/v4 | npm.cmd run migrate:down restores003; then coordinated recovery below | No earlier code directly on S2 |
| S30 live API probes | S2 | v4/v4 | Probe creates separate item, no schema undo | v4, old/new clients |
| S31 final tests/check | S2 | v4/v4 | Tests use isolated DB; no main DB mutation | v4 |
| S32 finish traffic | S2 | stopped after drain | Fresh process is a new run, not continuation | v4 can restart on S2 |
| S33 each down | Main S2 unchanged | stopped | Separate data/down-verify.db; Remove-Item Env:DB_PATH restores default main DB | Main compatibility unchanged |
| Final reports/commit | S2 | stopped | Correct documents with another commit; preserve raw logs/tags | As above |

## Exact Rolling Undo

Only stop the target server with Ctrl+C, wait for prompt and traffic down event; keep the other serving. In the stopped server's worktree, select the target version:

```powershell
cd ..\v2
$env:DB_PATH = (Resolve-Path ..\awad-price-migration-starter\data\app.db).Path
$env:PORT = '3001'
node src/server.js
```

Use cd ..\v1 for rollback to v1, cd ..\v3 for rollback/forward to v3, cd ..\v4 for forward to v4. Port3002 uses PORT='3002', all other commands identical. These commands are templates for the per-row targets, not a deploy script. Wait back + clean traffic tick, verify /health version/db/pid (v1 only has ok; also inspect worktree commit and server console), then npm.cmd run check -- expand|dual|canonical according to the row. New clients stay enabled for required v3→v2→v3 rollback since both support them and dual-write.

Before returning to v1, remove data/enable-new-clients if present and wait NEW_CLIENTS disabled plus a later new_inflight=0 tick. Do not down002 while v2/v3/v4 runs. Forward from v1 requires v2/v2, reconciliation backfill and immediate dual check before switching reads or enabling new clients.

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

Execution pending. Replace this section after completion with actual log ranges, version commits, traffic totals and deviations. Codex performs commands with user authorization; student review/ZIP/submission remain pending.
