export class Logger {
  private static instance: Logger | null = null;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public show(): void {}

  public log(serverId: string, message: string): void {
    console.log(`[${new Date().toISOString()}] [${serverId.toUpperCase()}] ${message}`);
  }

  public info(message: string): void {
    console.info(`[${new Date().toISOString()}] [SYSTEM:INFO] ${message}`);
  }

  public warn(message: string): void {
    console.warn(`[${new Date().toISOString()}] [SYSTEM:WARN] ${message}`);
  }

  public error(message: string, error?: unknown): void {
    let detail = "";
    if (error instanceof Error) {
      detail = `\nStack: ${error.stack ?? error.message}`;
    } else if (error) {
      detail = ` | ${String(error)}`;
    }
    console.error(`[${new Date().toISOString()}] [SYSTEM:ERROR] ${message}${detail}`);
  }

  public appendStream(serverId: string, data: Buffer | string, streamType: "stdout" | "stderr"): void {
    const lines = data.toString().split(/\r?\n/);
    const timestamp = new Date().toISOString();
    for (const line of lines) {
      if (line.trim().length > 0) {
        if (streamType === "stdout") {
          console.log(`[${timestamp}] [${serverId.toUpperCase()}:${streamType.toUpperCase()}] ${line}`);
        } else {
          console.error(`[${timestamp}] [${serverId.toUpperCase()}:${streamType.toUpperCase()}] ${line}`);
        }
      }
    }
  }

  public dispose(): void {
    Logger.instance = null;
  }
}
