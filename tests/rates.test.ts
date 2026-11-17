import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/http/app.js";
import { InMemoryCache } from "../src/infra/infra.js";
import { MockProvider } from "../src/providers/providers.js";
import type { RateRepository, UsdRates } from "../src/domain/types.js";
import { RateService, convert } from "../src/services/rateService.js";

class MemRepo implements RateRepository {
  data = new Map<string, UsdRates>();
  async saveUsdRates(d: string, r: UsdRates) {
    this.data.set(d, r);
  }
  async getUsdRates(d: string) {
    return this.data.get(d) ?? null;
  }
  async getLatestDate() {
    return [...this.data.keys()].sort().at(-1) ?? null;
  }
}

const makeService = () => {
  const provider = new MockProvider();
  const spy = vi.spyOn(provider, "fetchHistorical");
  const repository = new MemRepo();
  const service = new RateService({
    provider,
    repository,
    cache: new InMemoryCache(),
    cacheTtlSeconds: 60,
    now: () => new Date("2025-06-10T12:00:00Z"),
  });
  return { service, spy, repository };
};

describe("convert (unit)", () => {
  it("triangulates cross rates", () => {
    expect(convert({ USD: 1, EUR: 0.5, BRL: 5 }, "EUR", ["BRL"])).toEqual({ BRL: 10 });
  });
  it("throws on unknown currency", () => {
    expect(() => convert({ USD: 1 }, "XXX")).toThrow();
  });
});

describe("RateService (unit)", () => {
  it("fetches historical once, then serves from cache/repo", async () => {
    const { service, spy } = makeService();
    await service.getHistorical("2025-06-01", "USD", ["EUR"]);
    await service.getHistorical("2025-06-01", "USD", ["BRL"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("rejects future dates and bad codes", async () => {
    const { service } = makeService();
    await expect(service.getHistorical("2030-01-01", "USD")).rejects.toThrow(/future/);
    await expect(service.getLatest("usd1")).rejects.toThrow(/invalid/);
  });
});

describe("HTTP API (integration)", () => {
  it("GET /v1/rates/latest", async () => {
    const { service } = makeService();
    const app = await buildApp(service, { logger: false });
    const res = await app.inject("/v1/rates/latest?base=EUR&symbols=usd,brl");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.base).toBe("EUR");
    expect(Object.keys(body.rates).sort()).toEqual(["BRL", "USD"]);
  });
  it("returns 400 for invalid date and 404 for unknown currency", async () => {
    const { service } = makeService();
    const app = await buildApp(service, { logger: false });
    expect((await app.inject("/v1/rates/historical/abc")).statusCode).toBe(400);
    expect((await app.inject("/v1/rates/latest?base=ZZZ")).statusCode).toBe(404);
  });
});
