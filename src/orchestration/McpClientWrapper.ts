import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  Tool,
  Resource,
  Prompt,
  CallToolResult
} from "@modelcontextprotocol/sdk/types.js";
import { ProvisionedServerExecutionPlan } from "../utils/ServerProvisioner.js";
import { Logger } from "../utils/Logger.js";
import { ServerId } from "../types.js";

export class McpClientWrapper {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private readonly logger = Logger.getInstance();
  private isDisposing = false;

  constructor(
    public readonly serverId: ServerId,
    private readonly plan: ProvisionedServerExecutionPlan,
    private readonly onUnsolicitedExit: (serverId: ServerId, code: number | null, signal: string | null) => void
  ) {}

  public async startAndConnect(): Promise<{ tools: Tool[]; resources: Resource[]; prompts: Prompt[] }> {
    this.isDisposing = false;
    this.logger.info(`[${this.serverId}] Initializing StdioClientTransport: ${this.plan.command} ${this.plan.args.join(" ")}`);

    this.transport = new StdioClientTransport({
      command: this.plan.command,
      args: this.plan.args,
      env: this.plan.env,
      cwd: this.plan.workingDirectory,
      stderr: "pipe"
    });

    this.client = new Client(
      {
        name: `antygravity-orchestrator-${this.serverId}`,
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    if (this.transport.stderr) {
      this.transport.stderr.on("data", (chunk: Buffer) => {
        this.logger.appendStream(this.serverId, chunk, "stderr");
      });
    }

    this.transport.onerror = (err: Error) => {
      this.logger.error(`[${this.serverId}] Stdio transport error: ${err.message}`, err);
    };

    this.transport.onclose = () => {
      this.logger.warn(`[${this.serverId}] Transport stream closed.`);
      if (!this.isDisposing) {
        this.onUnsolicitedExit(this.serverId, null, "CLOSED");
      }
    };

    await this.client.connect(this.transport);
    this.logger.info(`[${this.serverId}] MCP Client successfully connected via Stdio.`);

    const [tools, resources, prompts] = await Promise.all([
      this.discoverTools(),
      this.discoverResources(),
      this.discoverPrompts()
    ]);

    this.logger.info(
      `[${this.serverId}] Discovered: ${tools.length} Tools, ${resources.length} Resources, ${prompts.length} Prompts`
    );

    return { tools, resources, prompts };
  }

  public async discoverTools(): Promise<Tool[]> {
    if (!this.client) {
      return [];
    }
    try {
      const response = await this.client.listTools();
      return (response.tools as Tool[]) ?? [];
    } catch (error) {
      this.logger.warn(`[${this.serverId}] Error querying listTools: ${String(error)}`);
      return [];
    }
  }

  public async discoverResources(): Promise<Resource[]> {
    if (!this.client) {
      return [];
    }
    try {
      const response = await this.client.listResources();
      return (response.resources as Resource[]) ?? [];
    } catch (error) {
      // "Method not found" is expected for servers that don't implement
      // resources capability — log quietly instead of warning.
      if (String(error).includes("-32601")) {
        this.logger.info(`[${this.serverId}] listResources not supported by server (method not found). Skipping.`);
      } else {
        this.logger.warn(`[${this.serverId}] Error querying listResources: ${String(error)}`);
      }
      return [];
    }
  }

  public async discoverPrompts(): Promise<Prompt[]> {
    if (!this.client) {
      return [];
    }
    try {
      const response = await this.client.listPrompts();
      return (response.prompts as Prompt[]) ?? [];
    } catch (error) {
      // "Method not found" is expected for servers that don't implement
      // prompts capability — log quietly instead of warning.
      if (String(error).includes("-32601")) {
        this.logger.info(`[${this.serverId}] listPrompts not supported by server (method not found). Skipping.`);
      } else {
        this.logger.warn(`[${this.serverId}] Error querying listPrompts: ${String(error)}`);
      }
      return [];
    }
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    if (!this.client) {
      throw new Error(`MCP Client for ${this.serverId} is not connected.`);
    }

    this.logger.info(`[${this.serverId}] Invoking tool '${name}' with arguments: ${JSON.stringify(args)}`);
    const result = await this.client.callTool({
      name,
      arguments: args
    });

    return result as CallToolResult;
  }

  public async disconnect(): Promise<void> {
    this.isDisposing = true;
    this.logger.info(`[${this.serverId}] Disconnecting MCP Client and terminating child process...`);

    if (this.client) {
      try {
        await this.client.close();
      } catch (err) {
        this.logger.warn(`[${this.serverId}] Exception while closing MCP client: ${String(err)}`);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (err) {
        this.logger.warn(`[${this.serverId}] Exception while closing transport: ${String(err)}`);
      }
      this.transport = null;
    }
  }
}
