import { ServerRepositoryDefinition } from "../types.js";
import { EnvironmentDetector } from "../utils/EnvironmentDetector.js";
import { ServerProvisioner } from "../utils/ServerProvisioner.js";
import { Logger } from "../utils/Logger.js";
import { McpClientWrapper } from "./McpClientWrapper.js";
import { Tool, Resource, Prompt, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ToolMapping {
  serverId: string;
  originalName: string;
}

export class StandaloneOrchestrator {
  private readonly logger = Logger.getInstance();
  private wrappers = new Map<string, McpClientWrapper>();
  private activeServers = new Set<string>();

  // A registry mapping tool names (including aliases) to server ID and original tool name
  private toolRegistry = new Map<string, ToolMapping>();

  // We can hardcode the servers or load from a config file. 
  // We'll hardcode the known polish-law-mcp servers for now.
  private readonly defaultServers: ServerRepositoryDefinition[] = [
    {
      id: "isap",
      repoUrl: "https://github.com/matematicsolutions/mcp-isap.git",
      defaultBranch: "main",
      runtime: "node",
      preferredEntryPoints: [],
      defaultEnv: {}
    },
    {
      id: "saos",
      repoUrl: "https://github.com/matematicsolutions/mcp-saos.git",
      defaultBranch: "main",
      runtime: "node",
      preferredEntryPoints: [],
      defaultEnv: {}
    },
    {
      id: "krs",
      repoUrl: "https://github.com/matematicsolutions/mcp-krs.git",
      defaultBranch: "main",
      runtime: "node",
      preferredEntryPoints: [],
      defaultEnv: {}
    },
    {
      id: "nsa",
      repoUrl: "https://github.com/matematicsolutions/mcp-nsa.git",
      defaultBranch: "main",
      runtime: "node",
      preferredEntryPoints: [],
      defaultEnv: {}
    },
    {
      id: "polish-law-mcp",
      repoUrl: "https://github.com/golebiepalkamtm-ship-it/polish-law-mcp.git",
      defaultBranch: "main",
      runtime: "node",
      preferredEntryPoints: ["dist/src/index.js", "dist/index.js", "build/index.js", "index.js"],
      defaultEnv: {}
    }
  ];

  public async start(): Promise<void> {
    this.logger.info("Starting Standalone Orchestrator...");
    const detector = new EnvironmentDetector();
    const binaries = await detector.detect();
    
    const provisioner = new ServerProvisioner(binaries);
    await provisioner.initializeStorage();

    const startPromises = this.defaultServers.map(async (def) => {
      try {
        const plan = await provisioner.provisionServer(def, false);
        const wrapper = new McpClientWrapper(def.id, plan, (id, code, signal) => {
          this.logger.warn(`Server ${id} exited unexpectedly with code ${code} and signal ${signal}`);
          this.activeServers.delete(id);
        });

        await wrapper.startAndConnect();
        this.wrappers.set(def.id, wrapper);
        this.activeServers.add(def.id);

        this.logger.info(`Successfully started server ${def.id}`);
      } catch (err) {
        this.logger.error(`Failed to start server ${def.id}: ${String(err)}`);
      }
    });

    await Promise.all(startPromises);
    
    // Initial discovery and tool registry indexing
    await this.getAvailableTools();
    
    this.logger.info(`Orchestrator initialization complete. ${this.activeServers.size} servers active.`);
  }

  public async getAvailableTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];
    this.toolRegistry.clear();

    const serverTools = new Map<string, Tool[]>();
    const nameCounts = new Map<string, number>();

    for (const [id, wrapper] of this.wrappers.entries()) {
      if (this.activeServers.has(id)) {
        try {
          const tools = await wrapper.discoverTools();
          serverTools.set(id, tools);
          for (const tool of tools) {
            nameCounts.set(tool.name, (nameCounts.get(tool.name) ?? 0) + 1);
          }
        } catch (err) {
          this.logger.warn(`Failed to discover tools for ${id}`);
        }
      }
    }

    for (const [id, tools] of serverTools.entries()) {
      for (const tool of tools) {
        const isColliding = (nameCounts.get(tool.name) ?? 0) > 1;
        const normalizedServerId = id.replace(/[^a-zA-Z0-9_]/g, "_");

        const exposedName = isColliding
          ? `${normalizedServerId}_${tool.name}`
          : tool.name;

        const registeredTool: Tool = {
          ...tool,
          name: exposedName,
          description: tool.description
        };

        allTools.push(registeredTool);

        // Register resolution mappings
        this.toolRegistry.set(exposedName, { serverId: id, originalName: tool.name });
        this.toolRegistry.set(`${normalizedServerId}_${tool.name}`, { serverId: id, originalName: tool.name });
        this.toolRegistry.set(`${normalizedServerId}__${tool.name}`, { serverId: id, originalName: tool.name });
        if (!isColliding) {
          this.toolRegistry.set(tool.name, { serverId: id, originalName: tool.name });
        }
      }
    }

    return allTools;
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const mapping = this.toolRegistry.get(name);
    if (!mapping) {
      throw new Error(`Unknown tool: ${name}. No server registered for this tool.`);
    }

    const wrapper = this.wrappers.get(mapping.serverId);
    if (!wrapper || !this.activeServers.has(mapping.serverId)) {
      throw new Error(`Server ${mapping.serverId} for tool ${name} is not active.`);
    }

    return wrapper.callTool(mapping.originalName, args);
  }

  public async stop(): Promise<void> {
    this.logger.info("Stopping Orchestrator...");
    const stopPromises = Array.from(this.wrappers.values()).map(wrapper => wrapper.disconnect());
    await Promise.all(stopPromises);
    this.wrappers.clear();
    this.activeServers.clear();
    this.toolRegistry.clear();
  }
}
