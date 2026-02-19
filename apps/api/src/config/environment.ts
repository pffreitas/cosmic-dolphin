import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Server Configuration
  // We accept both PORT (standard) and API_PORT (legacy)
  PORT: z.coerce.number().optional(),
  API_PORT: z.coerce.number().optional(),

  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Security
  // Enforce strong secret (min 32 chars) and no default fallback
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      JSON.stringify(parsed.error.format(), null, 2)
    );
    // Exit immediately if configuration is invalid
    process.exit(1);
  }

  return parsed.data;
};

const env = parseEnv();

export const config = {
  NODE_ENV: env.NODE_ENV,
  // Prefer PORT, fall back to API_PORT, then default to 3001
  PORT: env.PORT || env.API_PORT || 3001,
  HOST: env.HOST,
  LOG_LEVEL: env.LOG_LEVEL,
  DATABASE_URL: env.DATABASE_URL,
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: env.JWT_SECRET,
};
