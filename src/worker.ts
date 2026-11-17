import { Queue, Worker } from "bullmq";
import { pino } from "pino";
import { createContainer } from "./bootstrap.js";
import { config } from "./config.js";

const log = pino({ name: "worker" });
const { service, pool, redis } = createContainer();
const QUEUE = "refresh-rates";

// Job repetível: o BullMQ garante que só uma instância execute cada tick,
// permitindo escalar workers horizontalmente sem duplicar chamadas ao provedor.
const queue = new Queue(QUEUE, { connection: redis });
await queue.upsertJobScheduler("hourly-refresh", { pattern: config.REFRESH_CRON });
await queue.add("refresh-now", {}, { removeOnComplete: true }); // popula na subida

const worker = new Worker(
  QUEUE,
  async () => {
    const date = await service.refreshLatest();
    log.info({ date }, "rates refreshed");
  },
  { connection: redis, concurrency: 1 },
);

worker.on("failed", (job, err) => log.error({ jobId: job?.id, err }, "refresh failed"));

const shutdown = async () => {
  await worker.close();
  await queue.close();
  await pool.end();
  redis.disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
