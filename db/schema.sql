CREATE TABLE IF NOT EXISTS rates (
  date        DATE        NOT NULL,
  base        CHAR(3)     NOT NULL,
  quote       CHAR(3)     NOT NULL,
  rate        NUMERIC(24,10) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, base, quote)
);
-- "latest" = linha mais recente por base/quote; a data de hoje e atualizada pelo worker
CREATE INDEX IF NOT EXISTS rates_quote_idx ON rates (base, quote, date DESC);
