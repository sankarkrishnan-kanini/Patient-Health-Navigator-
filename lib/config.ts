import { AppError } from "@/lib/errors";

export type AppEnv = "local" | "production";

type RuntimeConfig = {
  appEnv: AppEnv;
  appName: string;
  logLevel: string;
};

const allowedAppEnvs = new Set<AppEnv>(["local", "production"]);

export function getRuntimeConfig(): RuntimeConfig {
  const appEnvRaw = process.env.APP_ENV ?? "local";
  if (!allowedAppEnvs.has(appEnvRaw as AppEnv)) {
    throw new AppError(
      "CONFIG_INVALID",
      "APP_ENV must be either 'local' or 'production'.",
      500
    );
  }

  return {
    appEnv: appEnvRaw as AppEnv,
    appName: process.env.APP_NAME ?? "patient-ai-health-navigator",
    logLevel: process.env.LOG_LEVEL ?? "info"
  };
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new AppError(
      "CONFIG_MISSING",
      `Missing required environment variable: ${name}.`,
      500
    );
  }

  return value;
}
