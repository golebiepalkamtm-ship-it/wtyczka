import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function run() {
  const transport = new SSEClientTransport(
    new URL("https://wtyczka-production.up.railway.app/sse")
  );

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  console.log("Connecting to MCP Orchestrator via SSE...");
  await client.connect(transport);
  console.log("Connected!");

  console.log("Fetching tools...");
  const response = await client.listTools();
  console.log("Available tools:");
  for (const tool of response.tools) {
    console.log(`- ${tool.name}: ${tool.description}`);
  }

  // Optionally, we could call a tool here
  // const result = await client.callTool({ name: "some_tool", arguments: {} });

  console.log("Closing connection...");
  await transport.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
