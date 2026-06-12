import { PGlite } from "@electric-sql/pglite";

const DATA_DIR =
  process.env.PGLITE_DATA_DIR ?? ".pglite";

let _pg: PGlite | null = null;
let _pending: Promise<PGlite> | null = null;

async function init(): Promise<PGlite> {
  if (_pg) return _pg;
  if (_pending) return _pending;
  _pending = (async () => {
    const pg = new PGlite(DATA_DIR);
    await pg.waitReady;
    _pg = pg;
    return pg;
  })();
  return _pending;
}

export type QueryResult<T> = { rows: T[] };

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const pg = await init();
  const res = await pg.query<T>(sql, params as any[]);
  return { rows: res.rows ?? [] };
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const { rows } = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function exec(sql: string): Promise<void> {
  const pg = await init();
  await pg.exec(sql);
}

export async function tx<T>(fn: (q: typeof query) => Promise<T>): Promise<T> {
  const pg = await init();
  return pg.transaction(async (txCtx) => {
    const txQuery: typeof query = async (sql, params = []) => {
      const r = await txCtx.query(sql, params as any[]);
      return { rows: (r.rows ?? []) as any[] };
    };
    return fn(txQuery);
  }) as Promise<T>;
}

export async function getDb(): Promise<PGlite> {
  return init();
}
