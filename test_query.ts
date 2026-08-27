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

  console.log("Calling get_entity tool (KRS 0000000001)...");
  try {
    const krsRes = await client.callTool({
      name: "get_entity",
      arguments: { krs: "0000000001" }
    });
    console.log("KRS result:", JSON.stringify(krsRes, null, 2).slice(0, 300) + "...");
  } catch (e) {
    console.error("KRS call error:", e);
  }

  console.log("Calling search_acts (ISAP)...");
  try {
    const isapRes = await client.callTool({
      name: "search_acts",
      arguments: { title: "kodeks karny", limit: 2 }
    });
    console.log("ISAP result:", JSON.stringify(isapRes, null, 2).slice(0, 300) + "...");
  } catch (e) {
    console.error("ISAP call error:", e);
  }

  console.log("Calling nsa_search (CBOSA)...");
  try {
    const nsaRes = await client.callTool({
      name: "nsa_search",
      arguments: { query: "podatek od towarów i usług", limit: 2 }
    });
    console.log("NSA result:", JSON.stringify(nsaRes, null, 2).slice(0, 300) + "...");
  } catch (e) {
    console.error("NSA call error:", e);
  }

  console.log("Closing connection...");
  await transport.close();
  process.exit(0);
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
