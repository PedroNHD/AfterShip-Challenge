/** Taxas com base USD: { EUR: 0.92, BRL: 5.1 } */
export type UsdRates = Readonly<Record<string, number>>;

export interface RateProvider {
  fetchLatest(): Promise<UsdRates>;
  fetchHistorical(date: string): Promise<UsdRates>;
}

export interface RateRepository {
  /** Substitui/insere as taxas USD->X de uma data. */
  saveUsdRates(date: string, rates: UsdRates): Promise<void>;
  getUsdRates(date: string): Promise<UsdRates | null>;
  /** Data mais recente disponível (YYYY-MM-DD) ou null. */
  getLatestDate(): Promise<string | null>;
}

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface RateResult {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export class NotFoundError extends Error {}
export class ValidationError extends Error {}
