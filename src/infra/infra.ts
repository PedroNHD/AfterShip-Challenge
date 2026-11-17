import { Redis } from "ioredis";
import pg from "pg";
import type { Cache, RateRepository, UsdRates } from "../domain/types.js";

export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}
  get(key: string) {
    return this.redis.get(key);
  }
  async set(key: string, value: string, ttl: number) {
    await this.redis.set(key, value, "EX", ttl);
  }
}

export class PgRateRepository implements RateRepository {
  constructor(private readonly pool: pg.Pool) {}

  async saveUsdRates(date: string, rates: UsdRates): Promise<void> {
    const entries = Object.entries(rates);
    if (entries.length === 0) return;
    // Insert em lote via unnest: 1 round-trip, idempotente (upsert).
    await this.pool.query(
      `INSERT INTO rates (date, base, quote, rate)
       SELECT $1::date, 'USD', q, r FROM unnest($2::text[], $3::numeric[]) AS t(q, r)
       ON CONFLICT (date, base, quote) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = now()`,
      [date, entries.map(([q]) => q), entries.map(([, r]) => r)],
    );
  }

  async getUsdRates(date: string): Promise<UsdRates | null> {
    const { rows } = await this.pool.query<{ quote: string; rate: string }>(
      `SELECT quote, rate FROM rates WHERE base = 'USD' AND date = $1::date`,
      [date],
    );
    if (rows.length === 0) return null;
    return Object.fromEntries(rows.map((r) => [r.quote, Number(r.rate)]));
  }

  async getLatestDate(): Promise<string | null> {
    const { rows } = await this.pool.query<{ d: string | null }>(
      `SELECT to_char(max(date), 'YYYY-MM-DD') AS d FROM rates WHERE base = 'USD'`,
    );
    return rows[0]?.d ?? null;
  }
}

export class InMemoryCache implements Cache {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
  }
}
