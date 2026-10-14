import { createServer } from 'node:http';
import { DB_PATH } from './db.js';

const APP_VERSION = 'v3';

// v2 reads legacy price and atomically writes both columns.
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};
const error = (res, status, code, message) => json(res, status, { error: code, message });

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

const isPrice = (p) => typeof p === 'number' && Number.isFinite(p) && p > 0 && p <= 100000;


const isVnd = (p) => Number.isSafeInteger(p) && p > 0 && p <= 100000000;

function normalizePrice(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const old = Object.hasOwn(body, 'price');
  const modern = Object.hasOwn(body, 'priceVnd');
  if (!old && !modern) return null;
  if (old && !isPrice(body.price)) return null;
  if (modern && !isVnd(body.priceVnd)) return null;
  const vnd = modern ? body.priceVnd : Math.round(body.price * 1000);
  if (!isVnd(vnd)) return null;
  if (old && modern && Math.round(body.price * 1000) !== vnd) return null;
  return { price: vnd / 1000, priceVnd: vnd };
}

export function createApp(db) {
  const q = {
    list: db.prepare('SELECT id, name, price_vnd FROM menu_items ORDER BY id LIMIT ? OFFSET ?'),
    get: db.prepare('SELECT id, name, price_vnd FROM menu_items WHERE id = ?'),
    insert: db.prepare('INSERT INTO menu_items (name, price, price_vnd) VALUES (?, ?, ?)'),
    setPrice: db.prepare('UPDATE menu_items SET price = ?, price_vnd = ? WHERE id = ?'),
    insertOrder: db.prepare("INSERT INTO orders (created_at) VALUES (datetime('now'))"),
    insertLine: db.prepare('INSERT INTO order_items (order_id, menu_item_id, qty, unit_price) VALUES (?, ?, ?, ?)'),
  };

  const view = (row) => ({ id: row.id, name: row.name, price: row.price_vnd / 1000, priceVnd: row.price_vnd });

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, version: APP_VERSION, db: DB_PATH, pid: process.pid });

    if (parts[0] === 'menu' && parts.length === 1) {
      if (req.method === 'GET') {
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        return json(res, 200, q.list.all(limit, offset).map(view));
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const money = normalizePrice(body);
        if (!body || typeof body.name !== 'string' || !body.name || !money)
          return error(res, 400, 'invalid_body', 'name and valid price or priceVnd are required');
        const { lastInsertRowid } = q.insert.run(body.name, money.price, money.priceVnd);
        return json(res, 201, view(q.get.get(lastInsertRowid)));
      }
    }

    if (parts[0] === 'menu' && parts.length === 2) {
      const id = Number(parts[1]);
      const row = Number.isInteger(id) ? q.get.get(id) : undefined;
      if (!row) return error(res, 404, 'not_found', `menu item ${parts[1]} not found`);
      if (req.method === 'GET') return json(res, 200, view(row));
      if (req.method === 'PATCH') {
        const body = await readBody(req);
        const money = normalizePrice(body);
        if (!money)
          return error(res, 400, 'invalid_body', 'valid price or priceVnd is required');
        q.setPrice.run(money.price, money.priceVnd, id);
        return json(res, 200, view(q.get.get(id)));
      }
    }

    if (req.method === 'POST' && url.pathname === '/orders') {
      const body = await readBody(req);
      if (!body || !Array.isArray(body.items) || body.items.length === 0)
        return error(res, 400, 'invalid_body', 'items: [{menuItemId, qty}] is required');
      db.exec('BEGIN IMMEDIATE');
      try {
        const { lastInsertRowid: orderId } = q.insertOrder.run();
        let total = 0;
        for (const { menuItemId, qty } of body.items) {
          const item = q.get.get(menuItemId);
          if (!item || !Number.isInteger(qty) || qty < 1) throw Object.assign(new Error(), { status: 400 });
          q.insertLine.run(orderId, item.id, qty, item.price_vnd / 1000);
          total += item.price_vnd * qty;
        }
        db.exec('COMMIT');
        return json(res, 201, { id: Number(orderId), total: total / 1000 });
      } catch (e) {
        db.exec('ROLLBACK');
        if (e.status === 400) return error(res, 400, 'invalid_item', 'unknown menuItemId or bad qty');
        throw e;
      }
    }

    return error(res, 404, 'not_found', 'no such route');
  }

  return createServer((req, res) => {
    handle(req, res).catch((e) => {
      console.error(e);
      if (!res.headersSent) error(res, 500, 'internal', e.message);
    });
  });
}
