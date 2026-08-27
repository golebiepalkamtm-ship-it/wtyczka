import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StandaloneOrchestrator } from "./orchestration/StandaloneOrchestrator.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "./utils/Logger.js";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const logger = Logger.getInstance();

const orchestrator = new StandaloneOrchestrator();

// Initialize the main MCP server
const mcpServer = new Server(
  {
    name: "antygravity-railway-orchestrator",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Map the tool listing to the orchestrator
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await orchestrator.getAvailableTools();
  return { tools };
});

// Map the tool calling to the orchestrator
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

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  logger.info("New SSE connection established");
  
  // Return an absolute URL for the messages endpoint to avoid client parsing issues
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  const messagesUrl = `${protocol}://${host}/messages`;
  
  transport = new SSEServerTransport(messagesUrl, res);
  await mcpServer.connect(transport);
});

app.post("/messages", express.json(), async (req, res) => {
  if (!transport) {
    res.status(400).send("No active SSE connection");
    return;
  }
  await transport.handlePostMessage(req, res);
});

async function main() {
  await orchestrator.start();
  
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`SSE Endpoint: http://localhost:${PORT}/sse`);
    logger.info(`Message Endpoint: http://localhost:${PORT}/messages`);
  });
}

main().catch(err => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
