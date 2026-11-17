import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { NotFoundError, ValidationError } from "../domain/types.js";
import type { RateService } from "../services/rateService.js";

const parseSymbols = (raw?: string) =>
  raw ? raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined;

const querySchema = {
  type: "object",
  properties: {
    base: { type: "string", default: "USD", description: "ISO-4217, ex.: USD" },
    symbols: { type: "string", description: "Lista separada por vírgula, ex.: EUR,BRL" },
  },
} as const;

export async function buildApp(service: RateService, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });

  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(swagger, { openapi: { info: { title: "Exchange Rate API", version: "1.0.0" } } });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ValidationError) return reply.code(400).send({ error: err.message });
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    req.log.error({ err }, "unhandled error");
    return reply.code(502).send({ error: "upstream or internal failure" });
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get<{ Querystring: { base?: string; symbols?: string } }>(
    "/v1/rates/latest",
    { schema: { querystring: querySchema, tags: ["rates"] } },
    async (req) => service.getLatest((req.query.base ?? "USD").toUpperCase(), parseSymbols(req.query.symbols)),
  );

  app.get<{ Params: { date: string }; Querystring: { base?: string; symbols?: string } }>(
    "/v1/rates/historical/:date",
    { schema: { querystring: querySchema, tags: ["rates"] } },
    async (req) =>
      service.getHistorical(req.params.date, (req.query.base ?? "USD").toUpperCase(), parseSymbols(req.query.symbols)),
  );

  return app;
}
