import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PROVIDER: z.enum(["openexchangerates", "mock"]).default("openexchangerates"),
  OXR_APP_ID: z.string().optional(),
  REFRESH_CRON: z.string().default("0 * * * *"),
  CACHE_TTL_SECONDS: z.coerce.number().default(300),
});

export const config = schema
  .refine((c) => c.PROVIDER === "mock" || !!c.OXR_APP_ID, {
    message: "OXR_APP_ID is required when PROVIDER=openexchangerates",
  })
  .parse(process.env);
