import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3001),
  API_PORT: z.coerce.number().optional(),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    JSON.stringify(parsedEnv.error.format(), null, 2)
  );
  process.exit(1);
}

const envVars = parsedEnv.data;

export const config = {
  NODE_ENV: envVars.NODE_ENV,
  // Fallback to API_PORT if PORT is not set (for backward compatibility)
  PORT: process.env.PORT ? envVars.PORT : (envVars.API_PORT || envVars.PORT),
  HOST: envVars.HOST,
  LOG_LEVEL: envVars.LOG_LEVEL,
  DATABASE_URL: envVars.DATABASE_URL,
  SUPABASE_URL: envVars.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: envVars.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: envVars.JWT_SECRET,
};
