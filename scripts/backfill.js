import { open } from '../src/db.js';

const db = open();
const maxBatches = Number(process.env.BACKFILL_MAX_BATCHES ?? 0);
if (!Number.isSafeInteger(maxBatches) || maxBatches < 0) throw new Error('Invalid BACKFILL_MAX_BATCHES');
const batchSize = 500;
try {
  const columns = db.prepare('PRAGMA table_info(menu_items)').all().map(c => c.name);
  if (!columns.includes('price') || !columns.includes('price_vnd'))
    throw new Error('Backfill requires expanded schema. Never run after v4 starts writing.');
  const invalid = db.prepare(`SELECT count(*) n FROM menu_items WHERE price IS NULL
    OR typeof(price) NOT IN ('integer','real') OR price <= 0 OR price > 100000
    OR round(price * 1000) < 1`).get().n;
  if (invalid) throw new Error(`Cannot backfill: ${invalid} invalid/missing source prices`);
  const update = db.prepare(`UPDATE menu_items
    SET price_vnd = CAST(round(price * 1000) AS INTEGER)
    WHERE id IN (SELECT id FROM menu_items
      WHERE price_vnd IS NULL OR typeof(price_vnd) <> 'integer'
        OR price_vnd <> CAST(round(price * 1000) AS INTEGER)
      ORDER BY id LIMIT ?)`);
  let total = 0, batches = 0;
  for (;;) {
    db.exec('BEGIN IMMEDIATE');
    let changes;
    try {
      changes = update.run(batchSize).changes;
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    total += changes;
    console.log(`batch=${changes} total=${total}`);
    if (changes === 0) { console.log('BACKFILL COMPLETE'); break; }
    batches++;
    if (maxBatches && batches >= maxBatches) {
      console.log(`BACKFILL PAUSED after ${batches} committed batches; pending work may remain`);
      break;
    }
    await new Promise(r => setTimeout(r, 20));
  }
} finally { db.close(); }
