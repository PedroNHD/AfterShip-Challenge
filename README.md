# Exchange Rate Service

Serviço que expõe taxas de câmbio **atuais e históricas** (fonte: openexchangerates.org).
**Trilha: back-end** (API REST + Swagger UI em `/docs` como front mínimo).

## Arquitetura (3 camadas + worker)

```
Cliente → [Apresentação] Fastify (http/app.ts)
        → [Negócio]      RateService (services/) — cache-aside, triangulação de moedas
        → [Dados]        Redis (cache) · Postgres (histórico) · Provedor OXR

Worker (BullMQ/Redis) → atualiza "latest" periodicamente → Postgres
```

- **Cache-aside**: Redis → Postgres → provedor externo; datas históricas são imutáveis, então persistem para sempre e poupam a cota do provedor.
- **Triangulação**: o plano gratuito da OXR só tem base USD; guardamos USD→X e calculamos qualquer base (`usd[Q]/usd[B]`).
- **Worker/pub-sub**: job repetível (`REFRESH_CRON`) em BullMQ; escala horizontalmente sem duplicar chamadas.
- **Ports & adapters**: `RateProvider`, `RateRepository`, `Cache` são interfaces → trocar provedor/DB é trivial e os testes rodam sem infraestrutura.
- **Segurança/prod**: validação de entrada, `helmet`, rate limit, config validada com zod, logs estruturados (pino), shutdown gracioso, container non-root.

## API

| Rota | Descrição |
|---|---|
| `GET /v1/rates/latest?base=USD&symbols=EUR,BRL` | taxas mais recentes |
| `GET /v1/rates/historical/2025-01-31?base=EUR` | taxas de uma data |
| `GET /health` · `GET /docs` | health e OpenAPI |

## Rodando

```bash
cp .env.example .env        # PROVIDER=mock roda sem chave
docker compose up --build   # api :3000 + worker + postgres + redis
npm install && npm test     # testes unitários e de integração HTTP
```

## Trade-offs / TODO
- Sem autenticação por API key (apenas rate limit por IP).
- Falha do provedor retorna 502; faltaria circuit breaker e fallback para um 2º provedor.
- Sem métricas Prometheus nem testes de integração com Postgres/Redis reais (Testcontainers).
- Backfill histórico é sob demanda (fetch-through), não em lote.
- Deploy: não realizado ainda (sugestão: Fly.io/Railway com o `docker-compose`).

## Sobre mim
Experiência com a stack: _preencha_. Currículo/perfil: _link_. App hospedado: _link_.
Todo o código foi escrito manualmente/assistido; não há boilerplate gerado por framework.
