type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

type LogRecord = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
};

type LoggerOptions = {
  source?: string;
  correlationId?: string;
};

function normalizeContext(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeContext(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      normalizeContext(item)
    ])
  );
}

function safeContext(input: LogContext): LogContext {
  return normalizeContext(input) as LogContext;
}

function emit(level: LogLevel, message: string, context: LogContext): void {
  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: safeContext(context)
  };

  const line = JSON.stringify(record);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger(options: LoggerOptions = {}) {
  const baseContext: LogContext = {
    source: options.source ?? "app",
    correlationId: options.correlationId ?? "unknown"
  };

  return {
    debug(message: string, context: LogContext = {}) {
      emit("debug", message, { ...baseContext, ...context });
    },
    info(message: string, context: LogContext = {}) {
      emit("info", message, { ...baseContext, ...context });
    },
    warn(message: string, context: LogContext = {}) {
      emit("warn", message, { ...baseContext, ...context });
    },
    error(message: string, context: LogContext = {}) {
      emit("error", message, { ...baseContext, ...context });
    }
  };
}

export function safeLogContext(context: LogContext): LogContext {
  return safeContext(context);
}
