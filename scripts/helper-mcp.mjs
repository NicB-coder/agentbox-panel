#!/usr/bin/env node
// The Helper's read-only tools, as a tiny MCP server (stdio, JSON-RPC, one message per line).
// It only forwards lookups to the panel on 127.0.0.1; it can't change anything.
import readline from "node:readline";

const PANEL = process.env.AGENTBOX_PANEL_URL || "http://127.0.0.1:3000";
// Proves to the panel that this is the Helper's own tool server. Comes from the panel by environment variable.
const SECRET = process.env.AGENTBOX_HELPER_SECRET || "";

function send(msg) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...msg }) + "\n");
}

async function panel(body) {
  const r = await fetch(`${PANEL}/api/helper/tools`, { method: "POST", headers: { "content-type": "application/json", "x-agentbox-helper-secret": SECRET }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`The panel answered ${r.status}`);
  return r.json();
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = m;
  if (id === undefined) return; // notifications need no answer
  try {
    if (method === "initialize") {
      send({ id, result: { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "agentbox-panel", version: "1.0.0" } } });
    } else if (method === "tools/list") {
      const { tools } = await panel({ list: true });
      send({ id, result: { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: true } })) } });
    } else if (method === "tools/call") {
      const { text } = await panel({ name: params?.name, args: params?.arguments ?? {} });
      send({ id, result: { content: [{ type: "text", text }] } });
    } else if (method === "ping") {
      send({ id, result: {} });
    } else {
      send({ id, error: { code: -32601, message: "Unknown method" } });
    }
  } catch (e) {
    if (method === "tools/call") send({ id, result: { content: [{ type: "text", text: `Couldn't look that up: ${e.message}` }], isError: true } });
    else send({ id, error: { code: -32603, message: String(e.message) } });
  }
});
