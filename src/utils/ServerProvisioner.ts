import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { EnvironmentBinaries, ServerRepositoryDefinition } from "../types.js";
import { Logger } from "./Logger.js";

const execFileAsync = promisify(execFile);

export interface ProvisionedServerExecutionPlan {
  readonly serverId: string;
  readonly workingDirectory: string;
  readonly command: string;
  readonly args: string[];
  readonly env: Record<string, string>;
}

export class ServerProvisioner {
  private readonly logger = Logger.getInstance();
  private readonly baseStorageDir: string;
  private readonly binaries: EnvironmentBinaries;

  constructor(binaries: EnvironmentBinaries) {
    this.baseStorageDir = path.join(process.cwd(), ".servers");
    this.binaries = binaries;
  }

  public async initializeStorage(): Promise<void> {
    await fs.mkdir(this.baseStorageDir, { recursive: true });
    
    // Add GitHub Token support for private repos
    if (process.env.GITHUB_TOKEN) {
      this.logger.info("Configuring Git with GITHUB_TOKEN for private repository access...");
      try {
        await this.runProcess(
          this.binaries.git, 
          ["config", "--global", `url.https://${process.env.GITHUB_TOKEN}@github.com/.insteadOf`, "https://github.com/"],
          process.cwd(),
          "system"
        );
      } catch (err) {
        this.logger.warn("Failed to configure git global credentials.");
      }
    }
  }

  public async provisionServer(
    definition: ServerRepositoryDefinition,
    forceReclone = false
  ): Promise<ProvisionedServerExecutionPlan> {
    const bundledDir = path.join(process.cwd(), "servers", definition.id);
    let serverDir = path.join(this.baseStorageDir, definition.id);

    if (await this.pathExists(bundledDir)) {
      this.logger.info(`[${definition.id}] Found bundled server directory in ${bundledDir}. Using local source.`);
      serverDir = bundledDir;
    } else {
      const gitDir = path.join(serverDir, ".git");
      const repoExists = await this.pathExists(gitDir);

      if (forceReclone && (await this.pathExists(serverDir))) {
        this.logger.info(`Force re-provision requested for ${definition.id}. Deleting ${serverDir}...`);
        await fs.rm(serverDir, { recursive: true, force: true });
      }

      if (!repoExists || forceReclone) {
        this.logger.info(`Cloning repository ${definition.repoUrl} into ${serverDir}...`);
        await fs.mkdir(serverDir, { recursive: true });
        await this.runProcess(
          this.binaries.git,
          ["clone", "--depth", "1", "--branch", definition.defaultBranch, definition.repoUrl, "."],
          serverDir,
          definition.id
        );
      } else {
        this.logger.info(`Repository for ${definition.id} exists. Pulling latest updates...`);
        try {
          await this.runProcess(this.binaries.git, ["pull", "--ff-only"], serverDir, definition.id);
        } catch (pullError) {
          this.logger.warn(`Failed to pull updates for ${definition.id}: ${String(pullError)}. Using cached repository.`);
        }
      }
    }

    if (definition.runtime === "python") {
      return await this.provisionPythonServer(definition, serverDir);
    } else {
      return await this.provisionNodeServer(definition, serverDir);
    }
  }

  private async provisionPythonServer(
    definition: ServerRepositoryDefinition,
    serverDir: string
  ): Promise<ProvisionedServerExecutionPlan> {
    const isWindows = process.platform === "win32";
    const venvDir = path.join(serverDir, ".venv");
    const venvPython = isWindows
      ? path.join(venvDir, "Scripts", "python.exe")
      : path.join(venvDir, "bin", "python");
    const venvPip = isWindows
      ? path.join(venvDir, "Scripts", "pip.exe")
      : path.join(venvDir, "bin", "pip");

    const venvExists = await this.pathExists(venvPython);

    if (!venvExists) {
      this.logger.info(`[${definition.id}] Creating Python virtual environment in ${venvDir}...`);
      if (this.binaries.hasUv && this.binaries.uv) {
        await this.runProcess(this.binaries.uv, ["venv", ".venv"], serverDir, definition.id);
      } else {
        await this.runProcess(this.binaries.python, ["-m", "venv", ".venv"], serverDir, definition.id);
      }
    }

    // Upgrade pip & wheel
    try {
      if (this.binaries.hasUv && this.binaries.uv) {
        await this.runProcess(this.binaries.uv, ["pip", "install", "--upgrade", "pip", "wheel", "setuptools"], serverDir, definition.id);
      } else {
        await this.runProcess(venvPip, ["install", "--upgrade", "pip", "wheel", "setuptools"], serverDir, definition.id);
      }
    } catch (e) {
      this.logger.warn(`[${definition.id}] Minor error upgrading build tools: ${String(e)}`);
    }

    // Install dependencies
    const reqFile = definition.fallbackRequirementsFile ?? "requirements.txt";
    const reqPath = path.join(serverDir, reqFile);
    const pyprojectPath = path.join(serverDir, "pyproject.toml");
    const setupPyPath = path.join(serverDir, "setup.py");

    if (await this.pathExists(pyprojectPath)) {
      this.logger.info(`[${definition.id}] Installing dependencies from pyproject.toml...`);
      if (this.binaries.hasUv && this.binaries.uv) {
        await this.runProcess(this.binaries.uv, ["pip", "install", "-e", "."], serverDir, definition.id);
      } else {
        await this.runProcess(venvPip, ["install", "-e", "."], serverDir, definition.id);
      }
    } else if (await this.pathExists(reqPath)) {
      this.logger.info(`[${definition.id}] Installing dependencies from ${reqFile}...`);
      if (this.binaries.hasUv && this.binaries.uv) {
        await this.runProcess(this.binaries.uv, ["pip", "install", "-r", reqFile], serverDir, definition.id);
      } else {
        await this.runProcess(venvPip, ["install", "-r", reqFile], serverDir, definition.id);
      }
    } else if (await this.pathExists(setupPyPath)) {
      this.logger.info(`[${definition.id}] Installing package via setup.py...`);
      await this.runProcess(venvPip, ["install", "-e", "."], serverDir, definition.id);
    } else {
      this.logger.warn(`[${definition.id}] No dependency manifest found. Installing fastmcp and mcp core dependencies.`);
      await this.runProcess(venvPip, ["install", "mcp", "fastmcp", "httpx", "pydantic", "beautifulsoup4"], serverDir, definition.id);
    }

    // Resolve entrypoint
    const entrypoint = await this.resolvePythonEntryPoint(serverDir, definition.preferredEntryPoints);

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      PYTHONUNBUFFERED: "1",
      PYTHONPATH: serverDir,
      VIRTUAL_ENV: venvDir,
      PATH: `${isWindows ? path.join(venvDir, "Scripts") : path.join(venvDir, "bin")}${path.delimiter}${process.env.PATH ?? ""}`,
      ...(definition.defaultEnv ?? {})
    };

    return {
      serverId: definition.id,
      workingDirectory: serverDir,
      command: venvPython,
      args: [entrypoint],
      env
    };
  }

  private async provisionNodeServer(
    definition: ServerRepositoryDefinition,
    serverDir: string
  ): Promise<ProvisionedServerExecutionPlan> {
    const nodeModulesDir = path.join(serverDir, "node_modules");
    const packageJsonPath = path.join(serverDir, "package.json");

    if (!(await this.pathExists(packageJsonPath))) {
      throw new Error(`[${definition.id}] Missing package.json in cloned repository.`);
    }

    const needsInstall = !(await this.pathExists(nodeModulesDir));
    if (needsInstall) {
      this.logger.info(`[${definition.id}] Running npm install...`);
      await this.runProcess(this.binaries.npm, ["install", "--prefer-offline", "--no-audit", "--include=dev"], serverDir, definition.id);
    }

    // Run build commands if defined
    if (definition.buildCommands && definition.buildCommands.length > 0) {
      for (const buildStep of definition.buildCommands) {
        this.logger.info(`[${definition.id}] Executing build step: ${buildStep.command} ${buildStep.args.join(" ")}`);
        const cmd = buildStep.command === "npm" ? this.binaries.npm : buildStep.command;
        await this.runProcess(cmd, buildStep.args, serverDir, definition.id);
      }
    } else {
      // Check if build script exists in package.json
      try {
        const pkgRaw = await fs.readFile(packageJsonPath, "utf-8");
        const pkgJson = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
        if (pkgJson.scripts && "build" in pkgJson.scripts) {
          this.logger.info(`[${definition.id}] Detected build script in package.json. Running npm run build...`);
          await this.runProcess(this.binaries.npm, ["run", "build"], serverDir, definition.id);
        }
      } catch (e) {
        this.logger.warn(`[${definition.id}] Failed to check/run build script: ${String(e)}`);
      }
    }

    const entrypoint = await this.resolveNodeEntryPoint(serverDir, definition.preferredEntryPoints);

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      NODE_ENV: "production",
      ...(definition.defaultEnv ?? {})
    };

    return {
      serverId: definition.id,
      workingDirectory: serverDir,
      command: this.binaries.node,
      args: [entrypoint],
      env
    };
  }

  private async resolvePythonEntryPoint(serverDir: string, preferredList: readonly string[]): Promise<string> {
    for (const pref of preferredList) {
      const target = path.isAbsolute(pref) ? pref : path.join(serverDir, pref);
      if (await this.pathExists(target)) {
        return target;
      }
    }

    const fallbackNames = ["server.py", "main.py", "app.py", "run.py", "src/server.py", "src/main.py", "mcp_server.py"];
    for (const name of fallbackNames) {
      const target = path.join(serverDir, name);
      if (await this.pathExists(target)) {
        return target;
      }
    }

    throw new Error(`Unable to determine executable Python entry point for server in ${serverDir}`);
  }

  private async resolveNodeEntryPoint(serverDir: string, preferredList: readonly string[]): Promise<string> {
    for (const pref of preferredList) {
      const target = path.isAbsolute(pref) ? pref : path.join(serverDir, pref);
      if (await this.pathExists(target)) {
        return target;
      }
    }

    const packageJsonPath = path.join(serverDir, "package.json");
    if (await this.pathExists(packageJsonPath)) {
      try {
        const pkgRaw = await fs.readFile(packageJsonPath, "utf-8");
        const pkg = JSON.parse(pkgRaw) as { main?: string; bin?: string | Record<string, string> };
        if (pkg.main) {
          const mainTarget = path.join(serverDir, pkg.main);
          if (await this.pathExists(mainTarget)) {
            return mainTarget;
          }
        }
        if (typeof pkg.bin === "string") {
          const binTarget = path.join(serverDir, pkg.bin);
          if (await this.pathExists(binTarget)) {
            return binTarget;
          }
        } else if (pkg.bin && typeof pkg.bin === "object") {
          const firstBin = Object.values(pkg.bin)[0];
          if (firstBin) {
            const binTarget = path.join(serverDir, firstBin);
            if (await this.pathExists(binTarget)) {
              return binTarget;
            }
          }
        }
      } catch {
        // Fall through
      }
    }

    const fallbacks = [
      "dist/index.js",
      "dist/src/index.js",
      "dist/server.js",
      "dist/src/server.js",
      "build/index.js",
      "build/src/index.js",
      "build/server.js",
      "out/index.js",
      "index.js",
      "server.js"
    ];
    for (const fb of fallbacks) {
      const target = path.join(serverDir, fb);
      if (await this.pathExists(target)) {
        return target;
      }
    }

    throw new Error(`Unable to locate compiled JavaScript entrypoint in ${serverDir}`);
  }

  private async runProcess(
    command: string,
    args: readonly string[],
    cwd: string,
    serverId: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const maskedArgs = args.map(arg => {
        let sanitized = arg;
        if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.length > 3) {
          sanitized = sanitized.split(process.env.GITHUB_TOKEN).join('***TOKEN***');
        }
        sanitized = sanitized.replace(/ghp_[a-zA-Z0-9]+/g, 'ghp_***');
        return sanitized;
      });
      this.logger.log(serverId, `[SETUP:EXEC] ${command} ${maskedArgs.join(" ")} (cwd: ${cwd})`);
      const safeCommand = (process.platform === "win32" && command.includes(" ")) ? `"${command}"` : command;
      const child = spawn(safeCommand, args, {
        cwd,
        env: process.env,
        shell: process.platform === "win32"
      });

      child.stdout.on("data", (data: Buffer) => {
        this.logger.appendStream(serverId, data, "stdout");
      });

      child.stderr.on("data", (data: Buffer) => {
        this.logger.appendStream(serverId, data, "stderr");
      });

      child.on("error", (err) => {
        this.logger.error(`[${serverId}] Process launch error: ${err.message}`, err);
        reject(err);
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          const err = new Error(`Command failed with exit code ${code}: ${command} ${args.join(" ")}`);
          this.logger.error(`[${serverId}] Setup step failed: ${err.message}`);
          reject(err);
        }
      });
    });
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
