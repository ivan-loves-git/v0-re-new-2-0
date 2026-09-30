import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import handler from "../api/mcp.js";

// Focused external seams: MCP initialization, tool metadata, tool calls, filtering, and generic handoff.
const http = createHttpServer(handler);
await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
const port = http.address().port;

const post = async (body) => {
  const res = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, 200);
  return res.json();
};
const request = (id, method, params) => post({ jsonrpc: "2.0", id, method, params });
const call = async (id, name, args) => {
  const result = await request(id, "tools/call", { name, arguments: args });
  return result.result ? JSON.parse(result.result.content[0].text) : result.error;
};

try {
  const init = await request(1, "initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "trial-verifier", version: "0" } });
  assert.equal(init.result.serverInfo.name, "re-new-business-discovery-trial");

  const listed = await request(2, "tools/list", {});
  assert.deepEqual(listed.result.tools.map((tool) => tool.name).sort(), ["get_public_opportunity_teaser", "search_public_opportunities"]);
  for (const tool of listed.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.idempotentHint, true);
    assert.equal(tool._meta["re-new.trial/authentication"], "none");
    assert.ok(tool.outputSchema.properties);
  }

  const filtered = await call(3, "search_public_opportunities", { sector: "logistics", geography: "France", annualRevenueBand: "EUR 3–5m" });
  assert.equal(filtered.opportunities.length, 1);
  assert.equal(filtered.opportunities[0].annualRevenueBand, "EUR 3–5m");
  assert.equal(filtered.opportunities[0].fictional, true);
  assert.equal(filtered.buyerAccess.accessUrl, "https://app.re-new.team/auth/login");
  assert.match(filtered.buyerAccess.instructions, /Request it to open Request access, then choose Repreneur/);
  assert.deepEqual(Object.keys(filtered.opportunities[0]).sort(), ["annualRevenueBand", "broadGeography", "demoId", "description", "fictional", "sector", "title"]);

  const broad = await call(4, "search_public_opportunities", { sector: "logistics" });
  assert.equal(broad.opportunities.some((card) => card.annualRevenueBand === "Not specified"), true);
  const noMatch = await call(5, "search_public_opportunities", { sector: "logistics", annualRevenueBand: "EUR 5–10m" });
  assert.equal(noMatch.opportunities.length, 0);
  const missingParameters = await call(6, "search_public_opportunities", {});
  assert.ok(missingParameters.opportunities.length > 0);

  assert.equal((await call(7, "get_public_opportunity_teaser", { demoId: "demo-logistics-01" })).found, true);
  for (const demoId of ["demo-withdrawn-01", "demo-unapproved-01", "demo-not-real-99"]) {
    assert.equal((await call(8, "get_public_opportunity_teaser", { demoId })).found, false);
  }

  for (const args of [
    { sector: "manufacturing" },
    { geography: "Italy" },
    { annualRevenueBand: "EUR 0–1m" },
  ]) {
    const invalid = await request(9, "tools/call", { name: "search_public_opportunities", arguments: args });
    assert.ok(invalid.error || invalid.result.isError, "Invalid tool input must be rejected through MCP.");
  }
  const missingDemoId = await request(10, "tools/call", { name: "get_public_opportunity_teaser", arguments: {} });
  assert.ok(missingDemoId.error || missingDemoId.result.isError, "A detail request without a demonstration ID must be rejected through MCP.");
  console.log("Verified external MCP initialization, metadata, schemas, fictional filtering, unavailable detail, invalid inputs, and generic Repreneur access handoff.");
} finally {
  await new Promise((resolve) => http.close(resolve));
}
