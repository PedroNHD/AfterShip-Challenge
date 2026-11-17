import type { RateProvider, UsdRates } from "../domain/types.js";

/** openexchangerates.org — base USD (plano gratuito). */
export class OpenExchangeRatesProvider implements RateProvider {
  constructor(
    private readonly appId: string,
    private readonly baseUrl = "https://openexchangerates.org/api",
  ) {}

  fetchLatest(): Promise<UsdRates> {
    return this.call("latest.json");
  }

  fetchHistorical(date: string): Promise<UsdRates> {
    return this.call(`historical/${date}.json`);
  }

  private async call(path: string): Promise<UsdRates> {
    const res = await fetch(`${this.baseUrl}/${path}?app_id=${this.appId}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`OXR ${path} failed with status ${res.status}`);
    const body = (await res.json()) as { rates?: UsdRates };
    if (!body.rates) throw new Error("OXR response without rates");
    return body.rates;
  }
}

/** Provedor determinístico para dev/testes sem chave externa. */
export class MockProvider implements RateProvider {
  private static readonly BASE: UsdRates = { USD: 1, EUR: 0.92, BRL: 5.1, GBP: 0.79, JPY: 150 };

  async fetchLatest(): Promise<UsdRates> {
    return MockProvider.BASE;
  }

  async fetchHistorical(date: string): Promise<UsdRates> {
    const drift = 1 + (Number(date.slice(-2)) % 7) / 100;
    return Object.fromEntries(
      Object.entries(MockProvider.BASE).map(([k, v]) => [k, k === "USD" ? 1 : v * drift]),
    );
  }
}
