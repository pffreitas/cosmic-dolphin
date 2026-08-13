import dotenv from "dotenv";

dotenv.config();

const DEFAULT_FRONTEND_ORIGIN = "http://localhost:3001";

export function getAllowedFrontendOrigins(frontendUrl?: string): string[] {
  const origins =
    frontendUrl
      ?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  return origins.length > 0 ? origins : [DEFAULT_FRONTEND_ORIGIN];
}

export function resolveFrontendOrigin(
  requestOrigin: string | undefined,
  allowedOrigins: string[] = getAllowedFrontendOrigins(process.env.FRONTEND_URL)
): string {
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] ?? DEFAULT_FRONTEND_ORIGIN;
}

const frontendOrigins = getAllowedFrontendOrigins(process.env.FRONTEND_URL);

export const config = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.API_PORT || "3001", 10),
  HOST: process.env.HOST || "0.0.0.0",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "",

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "",

  // Frontend
  FRONTEND_URL: frontendOrigins[0],
  FRONTEND_ORIGINS: frontendOrigins,
};
