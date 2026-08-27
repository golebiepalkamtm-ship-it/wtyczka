import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { EnvironmentBinaries } from "../types.js";
import { Logger } from "./Logger.js";

const execFileAsync = promisify(execFile);

export class EnvironmentDetector {
  private readonly logger = Logger.getInstance();

  public async detect(): Promise<EnvironmentBinaries> {
    this.logger.info("Detecting system environment and tools...");
    
    const [python, uv, node, npm, git] = await Promise.all([
      this.detectTool("python", "python3"),
      this.detectTool("uv", null),
      this.detectTool("node", "node"),
      this.detectTool("npm", "npm"),
      this.detectTool("git", "git")
    ]);

    if (!python) throw new Error("Python is required but could not be found.");
    if (!node) throw new Error("Node.js is required but could not be found.");
    if (!npm) throw new Error("npm is required but could not be found.");
    if (!git) throw new Error("git is required but could not be found.");

    return {
      python,
      hasUv: uv !== null,
      uv,
      node,
      npm,
      git
    };
  }

  private async detectTool(primary: string, fallback: string | null): Promise<string | null> {
    const isWin = process.platform === "win32";
    const whichCmd = isWin ? "where" : "which";
    
    try {
      const { stdout } = await execFileAsync(whichCmd, [primary]);
      if (stdout.trim()) {
        const firstMatch = stdout.trim().split(/\r?\n/)[0];
        this.logger.info(`Detected ${primary} at: ${firstMatch}`);
        return firstMatch;
      }
    } catch {
      // Primary failed
    }

    if (fallback) {
      try {
        const { stdout } = await execFileAsync(whichCmd, [fallback]);
        if (stdout.trim()) {
          const firstMatch = stdout.trim().split(/\r?\n/)[0];
          this.logger.info(`Detected ${primary} (via fallback ${fallback}) at: ${firstMatch}`);
          return firstMatch;
        }
      } catch {
        // Fallback failed
      }
    }

    this.logger.warn(`Could not find tool: ${primary}`);
    return null;
  }
}
