import {
  type Cache,
  NotFoundError,
  type RateProvider,
  type RateRepository,
  type RateResult,
  type UsdRates,
  ValidationError,
} from "../domain/types.js";

const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RateServiceDeps {
  provider: RateProvider;
  repository: RateRepository;
  cache: Cache;
  cacheTtlSeconds: number;
  now?: () => Date;
}

/**
 * Cache-aside: Redis -> Postgres -> provedor externo.
 * O plano gratuito da OXR só tem base USD, então guardamos USD->X e
 * calculamos qualquer base por triangulação: rate(B->Q) = usd[Q] / usd[B].
 */
export class RateService {
  constructor(private readonly deps: RateServiceDeps) {}

  private today(): string {
    return (this.deps.now?.() ?? new Date()).toISOString().slice(0, 10);
  }

  /** Chamado pelo worker: busca no provedor e persiste. */
  async refreshLatest(): Promise<string> {
    const rates = await this.deps.provider.fetchLatest();
    const date = this.today();
    await this.deps.repository.saveUsdRates(date, rates);
    return date;
  }

  async getLatest(base: string, symbols?: string[]): Promise<RateResult> {
    const date = (await this.deps.repository.getLatestDate()) ?? (await this.refreshLatest());
    return this.getForDate(date, base, symbols);
  }

  async getHistorical(date: string, base: string, symbols?: string[]): Promise<RateResult> {
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
      throw new ValidationError("date must be YYYY-MM-DD");
    }
    if (date > this.today()) throw new ValidationError("date cannot be in the future");
    return this.getForDate(date, base, symbols);
  }

  private async getForDate(date: string, base: string, symbols?: string[]): Promise<RateResult> {
    this.assertCurrency(base);
    symbols?.forEach((s) => this.assertCurrency(s));

    const cacheKey = `usd:${date}`;
    let usd = await this.readCache(cacheKey);
    if (!usd) {
      usd = await this.deps.repository.getUsdRates(date);
      if (!usd) {
        usd = await this.deps.provider.fetchHistorical(date);
        await this.deps.repository.saveUsdRates(date, usd);
      }
      await this.deps.cache.set(cacheKey, JSON.stringify(usd), this.deps.cacheTtlSeconds);
    }
    return { base, date, rates: convert(usd, base, symbols) };
  }

  private async readCache(key: string): Promise<UsdRates | null> {
    const raw = await this.deps.cache.get(key);
    return raw ? (JSON.parse(raw) as UsdRates) : null;
  }

  private assertCurrency(code: string): void {
    if (!CURRENCY_RE.test(code)) throw new ValidationError(`invalid currency code: ${code}`);
  }
}

export function convert(usd: UsdRates, base: string, symbols?: string[]): Record<string, number> {
  const baseRate = usd[base];
  if (baseRate === undefined) throw new NotFoundError(`unknown base currency: ${base}`);
  const wanted = symbols?.length ? symbols : Object.keys(usd);
  const out: Record<string, number> = {};
  for (const s of wanted) {
    const r = usd[s];
    if (r === undefined) throw new NotFoundError(`unknown currency: ${s}`);
    out[s] = Number((r / baseRate).toPrecision(10));
  }
  return out;
}
