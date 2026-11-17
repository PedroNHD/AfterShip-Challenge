import { Redis } from "ioredis";
import pg from "pg";
import { config } from "./config.js";
import { PgRateRepository, RedisCache } from "./infra/infra.js";
import { MockProvider, OpenExchangeRatesProvider } from "./providers/providers.js";
import { RateService } from "./services/rateService.js";

export function createContainer() {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const provider =
    config.PROVIDER === "mock" ? new MockProvider() : new OpenExchangeRatesProvider(config.OXR_APP_ID!);
  const service = new RateService({
    provider,
    repository: new PgRateRepository(pool),
    cache: new RedisCache(redis),
    cacheTtlSeconds: config.CACHE_TTL_SECONDS,
  });
  return { pool, redis, service };
}
