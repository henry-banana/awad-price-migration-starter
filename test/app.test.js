import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { open } from '../src/db.js';
import { createApp } from '../src/app.js';

async function fixture(run) {
  const db = open(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.up.sql')).sort())
    db.exec(readFileSync(new URL(file, dir), 'utf8'));
  const legacy = db.prepare('PRAGMA table_info(menu_items)').all().some(c => c.name === 'price');
  if (legacy) db.exec("INSERT INTO menu_items(name,price,price_vnd) VALUES ('Pho',45.5,45500),('Tea',5,5000)");
  else db.exec("INSERT INTO menu_items(name,price_vnd) VALUES ('Pho',45500),('Tea',5000)");
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const call = async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  try { await run({ db, call, legacy }); }
  finally { await new Promise(r => server.close(r)); db.close(); }
}

test('GET detail and list preserve old and new price fields', async () => fixture(async ({ call }) => {
  const item = await call('GET', '/menu/1');
  assert.deepEqual(item.body, { id: 1, name: 'Pho', price: 45.5, priceVnd: 45500 });
  const list = await call('GET', '/menu?limit=2');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
  assert.equal(list.body[0].priceVnd, 45500);
}));

test('old/new POST and PATCH persist correct integer prices', async () => fixture(async ({ db, call }) => {
  for (const [input, expected] of [[{ price: 45.5 },45500], [{ priceVnd: 27500 },27500]]) {
    const created = await call('POST', '/menu', { name: 'New dish', ...input });
    assert.equal(created.status, 201);
    assert.equal(created.body.priceVnd, expected);
    assert.equal(created.body.price, expected / 1000);
    assert.equal(db.prepare('SELECT price_vnd FROM menu_items WHERE id=?').get(created.body.id).price_vnd, expected);
    for (const body of [{ price: 46.5 }, { priceVnd: 63000 }]) {
      const updated = await call('PATCH', `/menu/${created.body.id}`, body);
      const vnd = body.priceVnd ?? Math.round(body.price * 1000);
      assert.equal(updated.status, 200);
      assert.equal(updated.body.price, vnd / 1000);
      assert.equal(updated.body.priceVnd, vnd);
      assert.equal(db.prepare('SELECT price_vnd FROM menu_items WHERE id=?').get(created.body.id).price_vnd, vnd);
    }
  }
}));

test('orders preserve thousand-dong unit and recorded unit_price', async () => fixture(async ({ db, call }) => {
  const r = await call('POST', '/orders', { items: [{ menuItemId: 1, qty: 2 }, { menuItemId: 2, qty: 1 }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 96);
  assert.equal(db.prepare('SELECT unit_price FROM order_items WHERE menu_item_id=1').get().unit_price, 45.5);
}));

test('invalid price and conflicting fields reject both write paths', async () => fixture(async ({ call }) => {
  const bodies = [{ price: 0 }, { price: -1 }, { price: 100001 }, { price: '45.5' },
    { price: 0.0001 }, { priceVnd: 0 }, { priceVnd: -1 }, { priceVnd: 1.5 },
    { priceVnd: '45500' }, { priceVnd: 100000001 }, { price: 40, priceVnd: 50000 }, {}];
  for (const body of bodies) {
    assert.equal((await call('POST', '/menu', { name: 'Invalid', ...body })).status, 400);
    assert.equal((await call('PATCH', '/menu/1', body)).status, 400);
  }
}));

test('sub-dong inputs normalize once and errors retain their shape', async () => fixture(async ({ call }) => {
  const r = await call('POST', '/menu', { name: 'Rounded', price: 45.5006 });
  assert.equal(r.status, 201);
  assert.equal(r.body.priceVnd, 45501);
  assert.equal(r.body.price, 45.501);
  assert.equal((await call('GET', '/menu/99999')).body.error, 'not_found');
}));

test('v4 works before and after drop, preserves legacy API and never writes old column', async () => fixture(async ({ db, call, legacy }) => {
  if (legacy) db.exec('UPDATE menu_items SET price=1 WHERE id=1');
  assert.equal((await call('GET', '/menu/1')).body.price, 45.5);
  assert.equal((await call('GET', '/menu?limit=1')).body[0].priceVnd, 45500);
  assert.equal((await call('POST', '/orders', { items: [{ menuItemId: 1, qty: 2 }] })).body.total, 91);
  await call('PATCH', '/menu/1', { price: 63 });
  const created = await call('POST', '/menu', { name: 'Old client', price: 44.5 });
  assert.equal(created.status, 201);
  assert.equal(created.body.price, 44.5);
  if (legacy) {
    assert.equal(db.prepare('SELECT price FROM menu_items WHERE id=1').get().price, 1);
    assert.equal(db.prepare('SELECT price FROM menu_items WHERE id=?').get(created.body.id).price, null);
  } else {
    assert.ok(!db.prepare('PRAGMA table_info(menu_items)').all().some(c => c.name === 'price'));
    assert.equal((await call('PATCH', `/menu/${created.body.id}`, { priceVnd: 46000 })).body.price, 46);
  }
}));
