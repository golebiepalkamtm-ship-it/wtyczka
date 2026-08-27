import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StandaloneOrchestrator } from "./orchestration/StandaloneOrchestrator.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "./utils/Logger.js";

const logger = Logger.getInstance();
const orchestrator = new StandaloneOrchestrator();

const mcpServer = new Server(
  {
    name: "antygravity-local-orchestrator",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await orchestrator.getAvailableTools();
  return { tools };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await orchestrator.callTool(request.params.name, request.params.arguments || {});
    return result;
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error calling tool: ${err.message}` }],
      isError: true
    };
  }
});

async function main() {
  await orchestrator.start();
  
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  logger.info("Stdio MCP Server connected successfully");
}

main().catch(err => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
