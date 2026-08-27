import { ServerRepositoryDefinition } from "../types.js";
import { EnvironmentDetector } from "../utils/EnvironmentDetector.js";
import { ServerProvisioner } from "../utils/ServerProvisioner.js";
import { Logger } from "../utils/Logger.js";
import { McpClientWrapper } from "./McpClientWrapper.js";
import { Tool, Resource, Prompt, CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class StandaloneOrchestrator {
  private readonly logger = Logger.getInstance();
  private wrappers = new Map<string, McpClientWrapper>();
  private activeServers = new Set<string>();

  // A registry mapping tool names to their source server ID
  private toolRegistry = new Map<string, string>();

  // We can hardcode the servers or load from a config file. 
  // We'll hardcode the known polish-law-mcp servers for now.
  private readonly defaultServers: ServerRepositoryDefinition[] = [
    {
      id: "nalegalu",
      repoUrl: "https://github.com/Ansvar-Systems/nalegalu-mcp.git",
      defaultBranch: "main",
      runtime: "python",
      preferredEntryPoints: ["src/server.py", "server.py", "main.py"],
      defaultEnv: {}
    },
    {
      id: "prawmi",
      repoUrl: "https://github.com/Ansvar-Systems/prawmi-mcp.git",
      defaultBranch: "main",
      runtime: "python",
      preferredEntryPoints: ["src/server.py", "server.py", "main.py"],
      defaultEnv: {}
    },
    {
      id: "isap",
      repoUrl: "https://github.com/Ansvar-Systems/isap-mcp.git",
      defaultBranch: "main",
      runtime: "python",
      preferredEntryPoints: ["src/isap_mcp/server.py", "server.py"],
      defaultEnv: {}
    },
    {
      id: "saos",
      repoUrl: "https://github.com/Ansvar-Systems/saos-mcp.git",
      defaultBranch: "main",
      runtime: "python",
      preferredEntryPoints: ["src/saos_mcp/server.py", "server.py"],
      defaultEnv: {}
    },
    {
      id: "krs",
      repoUrl: "https://github.com/Ansvar-Systems/krs-mcp.git",
      defaultBranch: "main",
      runtime: "python",
      preferredEntryPoints: ["src/krs_mcp/server.py", "server.py"],
      defaultEnv: {}
    },
    {
      id: "nsa",
      repoUrl: "https://github.com/Ansvar-Systems/nsa-mcp.git",
      defaultBranch: "main",
      runtime: "python",
      preferredEntryPoints: ["src/nsa_mcp/server.py", "server.py"],
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

        const { tools } = await wrapper.startAndConnect();
        this.wrappers.set(def.id, wrapper);
        this.activeServers.add(def.id);

        // Register tools
        for (const tool of tools) {
          this.toolRegistry.set(tool.name, def.id);
        }

        this.logger.info(`Successfully started and registered tools for ${def.id}`);
      } catch (err) {
        this.logger.error(`Failed to start server ${def.id}: ${String(err)}`);
      }
    });

    await Promise.all(startPromises);
    this.logger.info(`Orchestrator initialization complete. ${this.activeServers.size} servers active.`);
  }

  public async getAvailableTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];
    for (const [id, wrapper] of this.wrappers.entries()) {
      if (this.activeServers.has(id)) {
        try {
          const tools = await wrapper.discoverTools();
          allTools.push(...tools);
          
          // Update registry in case tools changed
          for (const tool of tools) {
            this.toolRegistry.set(tool.name, id);
          }
        } catch (err) {
          this.logger.warn(`Failed to discover tools for ${id}`);
        }
      }
    }
    return allTools;
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const serverId = this.toolRegistry.get(name);
    if (!serverId) {
      throw new Error(`Unknown tool: ${name}. No server registered for this tool.`);
    }

    const wrapper = this.wrappers.get(serverId);
    if (!wrapper || !this.activeServers.has(serverId)) {
      throw new Error(`Server ${serverId} for tool ${name} is not active.`);
    }

    return wrapper.callTool(name, args);
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
