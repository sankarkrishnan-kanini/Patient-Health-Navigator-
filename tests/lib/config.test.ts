import { getRuntimeConfig, requireEnv } from "@/lib/config";
import { AppError } from "@/lib/errors";

describe("config helper", () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it("returns safe default runtime configuration", () => {
    delete process.env.APP_ENV;
    delete process.env.APP_NAME;
    delete process.env.LOG_LEVEL;

    const config = getRuntimeConfig();

    expect(config).toEqual({
      appEnv: "local",
      appName: "patient-ai-health-navigator",
      logLevel: "info"
    });
  });

  it("throws AppError when APP_ENV has unsupported value", () => {
    process.env.APP_ENV = "qa";

    expect(() => getRuntimeConfig()).toThrow(AppError);
    expect(() => getRuntimeConfig()).toThrow("APP_ENV must be either 'local' or 'production'.");
  });

  it("returns requested environment variable when present", () => {
    process.env.OPENAI_API_KEY = "test-key";

    expect(requireEnv("OPENAI_API_KEY")).toBe("test-key");
  });

  it("throws AppError when required environment variable is missing", () => {
    delete process.env.OPENAI_API_KEY;

    expect(() => requireEnv("OPENAI_API_KEY")).toThrow(AppError);
    expect(() => requireEnv("OPENAI_API_KEY")).toThrow(
      "Missing required environment variable: OPENAI_API_KEY."
    );
  });
});
