import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || '';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

if (!url || !authToken) {
  throw new Error(
    'Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no .env (ex.: libsql://seu-db.aws-us-east-1.turso.io)'
  );
}

const client = createClient({ url, authToken });

function rowToObject(row) {
  if (!row) return null;
  const obj = {};
  for (const [k, v] of Object.entries(row)) obj[k] = v;
  return obj;
}

const db = {
  async exec(sql) {
    await client.execute(sql);
  },

  prepare(sql) {
    return {
      async get(...args) {
        const result = await (args.length
          ? client.execute({ sql, args })
          : client.execute(sql));
        const row = result.rows[0];
        return row ? rowToObject(row) : null;
      },
      async all(...args) {
        const result = await (args.length
          ? client.execute({ sql, args })
          : client.execute(sql));
        return (result.rows || []).map((row) => rowToObject(row));
      },
      async run(...args) {
        const result = await (args.length
          ? client.execute({ sql, args })
          : client.execute(sql));
        const lastInsertRowid = result.lastInsertRowid != null ? Number(result.lastInsertRowid) : undefined;
        const changes = result.rowsAffected ?? 0;
        return { lastInsertRowid, changes };
      },
    };
  },
};

async function init() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      source_url TEXT,
      raw_data TEXT NOT NULL,
      selected_images TEXT,
      webhook_payload TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      logo_url TEXT,
      status TEXT DEFAULT 'lead',
      plan TEXT,
      email TEXT,
      phone TEXT,
      phone_secondary TEXT,
      document TEXT,
      creci TEXT,
      contact_name TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      website TEXT,
      instagram TEXT,
      facebook TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const clientNewCols = [
    'email', 'phone', 'phone_secondary', 'document', 'creci', 'contact_name',
    'address', 'city', 'state', 'zip', 'website', 'instagram', 'facebook', 'notes',
    'credits_remaining',
  ];
  for (const col of clientNewCols) {
    try {
      const info = await db.prepare('PRAGMA table_info(clients)').all();
      const names = (info || []).map((r) => r.name);
      if (!names.includes(col)) {
        await db.exec(`ALTER TABLE clients ADD COLUMN ${col} ${col === 'credits_remaining' ? 'INTEGER' : 'TEXT'}`);
      }
    } catch (_) {}
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS vendas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      valor REAL NOT NULL,
      descricao TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  try {
    const listInfo = await db.prepare('PRAGMA table_info(listings)').all();
    const listCols = (listInfo || []).map((c) => c.name);
    if (!listCols.includes('client_id')) await db.exec('ALTER TABLE listings ADD COLUMN client_id INTEGER');
    if (!listCols.includes('source_url')) await db.exec('ALTER TABLE listings ADD COLUMN source_url TEXT');
  } catch (_) {}

  const defaultSettings = {
    kpis: { leads: 0, clientes_ativos: 0, negociacoes: 0, vendas_mes: 0 },
    payment_links: { plan_65: '', plan_297: '', plan_497: '' },
    webhook_captacao: '',
    webhook_producao: '',
    plans: [
      { id: '297', label: 'R$ 297', price: 297, credit_label: 'Vídeos simples', credit_count: 5 },
      { id: '497', label: 'R$ 497', price: 497, credit_label: 'Vídeos simples', credit_count: 10 },
      { id: '997', label: 'R$ 997', price: 997, credit_label: 'Vídeos com narração', credit_count: 10 },
    ],
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    const exists = await db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
    if (!exists) await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  }
}

export default db;
export { init };
