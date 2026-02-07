export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: any;
}

/**
 * Structured Logger for Cloudflare Workers/Hono
 * Outputs JSON logs to stdout/stderr which are captured by Cloudflare's logging system.
 */
class Logger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  private output(
    level: LogLevel,
    message: string,
    meta: Record<string, any> = {},
  ) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...meta,
    };

    const str = JSON.stringify(entry);

    // In Cloudflare Workers, console.log/error are captured.
    if (level === "error") {
      console.error(str);
    } else {
      console.log(str);
    }
  }

  debug(message: string, meta?: Record<string, any>) {
    this.output("debug", message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.output("info", message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.output("warn", message, meta);
  }

  /**
   * Log an error.
   * @param message The error message
   * @param error The error object (optional)
   * @param meta Additional metadata (optional)
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, any>) {
    const errorMeta: Record<string, any> = { ...meta };

    if (error instanceof Error) {
      const { name, message, stack, ...rest } = error as any;
      errorMeta.error = {
        name,
        message,
        stack,
        ...rest,
      };
    } else if (typeof error === "object" && error !== null) {
      errorMeta.error = error;
    } else if (error) {
      errorMeta.error = String(error);
    }

    this.output("error", message, errorMeta);
  }

  /**
   * Create a child logger with additional context
   */
  child(meta: Record<string, any>) {
    return new Logger({ ...this.context, ...meta });
  }
}

const logger = new Logger();

export default logger;
