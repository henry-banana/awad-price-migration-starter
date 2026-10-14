import { open, DB_PATH } from '../src/db.js';

const phase = process.argv[2];
const phases = ['baseline', 'expand', 'dual', 'canonical', 'contract'];
if (!phases.includes(phase)) {
  console.error('Usage: npm run check -- baseline|expand|dual|canonical|contract');
  process.exit(2);
}
const db = open();
try {
  db.exec('BEGIN'); // All counts belong to one read snapshot.
  const cols = new Set(db.prepare('PRAGMA table_info(menu_items)').all().map(c => c.name));
  const count = sql => db.prepare(sql).get().n;
  const out = { phase, db: DB_PATH, columns: [...cols].join(', '),
    rows: count('SELECT count(*) n FROM menu_items') };
  const legacy = cols.has('price'), modern = cols.has('price_vnd');
  if (legacy) {
    out.legacy_invalid = count(`SELECT count(*) n FROM menu_items WHERE price IS NULL
      OR typeof(price) NOT IN ('integer','real') OR price <= 0 OR price > 100000
      OR round(price * 1000) < 1`);
  }
  if (modern) {
    out.price_vnd_null = count('SELECT count(*) n FROM menu_items WHERE price_vnd IS NULL');
    out.price_vnd_not_integer = count(`SELECT count(*) n FROM menu_items
      WHERE price_vnd IS NOT NULL AND typeof(price_vnd) <> 'integer'`);
    out.price_vnd_invalid = count(`SELECT count(*) n FROM menu_items WHERE price_vnd IS NOT NULL
      AND (typeof(price_vnd) <> 'integer' OR price_vnd < 1 OR price_vnd > 100000000)`);
  }
  if (legacy && modern) {
    out.disagree = count(`SELECT count(*) n FROM menu_items
      WHERE price IS NOT NULL AND price_vnd IS NOT NULL
      AND price_vnd <> CAST(round(price * 1000) AS INTEGER)`);
    out.legacy_missing_with_vnd = count(`SELECT count(*) n FROM menu_items
      WHERE price IS NULL AND price_vnd IS NOT NULL`);
  }
  let ok;
  if (phase === 'baseline') ok = legacy && !modern && out.legacy_invalid === 0;
  if (phase === 'expand') ok = legacy && modern && out.legacy_invalid === 0
    && out.price_vnd_invalid === 0;
  if (phase === 'dual') ok = legacy && modern && out.legacy_invalid === 0
    && out.price_vnd_null === 0 && out.price_vnd_invalid === 0 && out.disagree === 0;
  if (phase === 'canonical' || phase === 'contract') ok = modern
    && out.price_vnd_null === 0 && out.price_vnd_invalid === 0
    && (phase !== 'contract' || !legacy);
  db.exec('COMMIT');
  for (const [key, value] of Object.entries(out)) console.log(`${key.padEnd(26)} ${value}`);
  if (phase === 'expand') console.log('Legacy authoritative; NULL/mismatch in price_vnd are pending reconciliation.');
  if (phase === 'canonical') console.log('price_vnd authoritative; legacy counts remain visible but do not decide this phase.');
  console.log(ok ? 'CONSISTENT' : 'INCONSISTENT');
  process.exitCode = ok ? 0 : 1;
} finally { db.close(); }
