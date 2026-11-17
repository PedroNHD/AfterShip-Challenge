import { createContainer } from "./bootstrap.js";
import { config } from "./config.js";
import { buildApp } from "./http/app.js";

const { service, pool, redis } = createContainer();
const app = await buildApp(service);

const shutdown = async () => {
  await app.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: config.PORT, host: "0.0.0.0" });
