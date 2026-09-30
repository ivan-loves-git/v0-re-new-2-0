import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { buyerAccessHandoff, getPublicOpportunityTeaser, searchPublicOpportunities } from "../src/discovery.js";

const revenueBands = ["EUR 3–5m", "EUR 5–10m"];
const safeCardOutput = {
  demoId: z.string().describe("Fictional demonstration identifier only."),
  title: z.string().describe("Anonymous fictional teaser title."),
  sector: z.enum(["logistics", "services"]),
  broadGeography: z.literal("France"),
  annualRevenueBand: z.string().describe("Displayed annual revenue band in EUR, or Not specified."),
  description: z.string().describe("Fictional anonymous description with no identifying information."),
  fictional: z.literal(true),
};
const buyerAccessOutput = {
  fictional: z.literal(true),
  accessUrl: z.literal("https://app.re-new.team/auth/login"),
  instructions: z.string().describe("Generic access steps: click Request it to open Request access, then choose Repreneur (buyer)."),
};
const noAuthMetadata = { "re-new.trial/authentication": "none" };
const response = (payload) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  structuredContent: payload,
});

export function createServer() {
  const server = new McpServer({ name: "re-new-business-discovery-trial", version: "0.0.0-prototype" });
  server.registerTool(
    "search_public_opportunities",
    {
      title: "Search fictional public opportunity teasers",
      description: "Read-only search over fictional, anonymous Re-New demonstration teasers. Returns at most three active, publication-approved cards and a generic buyer access handoff.",
      inputSchema: {
        sector: z.enum(["logistics", "services"]).optional().describe("Optional sector filter."),
        geography: z.literal("France").optional().describe("France is the only geography in this fictional trial."),
        annualRevenueBand: z.enum(revenueBands).optional().describe("Optional annual revenue band in EUR. Listings with an unspecified band are excluded when this is supplied."),
      },
      outputSchema: { fictional: z.literal(true), disclaimer: z.string(), opportunities: z.array(z.object(safeCardOutput)).max(3), buyerAccess: z.object(buyerAccessOutput) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: noAuthMetadata,
    },
    async (input) => response({ ...searchPublicOpportunities(input), buyerAccess: buyerAccessHandoff() }),
  );
  server.registerTool(
    "get_public_opportunity_teaser",
    {
      title: "Get a fictional public opportunity teaser",
      description: "Read-only lookup of one fictional anonymous teaser. Inactive or publication-unapproved fixtures return an honest unavailable result.",
      inputSchema: { demoId: z.string().regex(/^demo-[a-z-]+-\d+$/).describe("A fictional demonstration ID returned by search.") },
      outputSchema: { fictional: z.literal(true), disclaimer: z.string(), found: z.boolean(), message: z.string().optional(), opportunity: z.object(safeCardOutput).optional(), buyerAccess: z.object(buyerAccessOutput) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: noAuthMetadata,
    },
    async (input) => response({ ...getPublicOpportunityTeaser(input), buyerAccess: buyerAccessHandoff() }),
  );
  return server;
}

async function readBody(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
    if (typeof req.body === "string") return JSON.parse(req.body);
    if (typeof req.body === "object") return req.body;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : undefined;
}

/** Vercel-compatible, stateless Streamable HTTP endpoint at /api/mcp. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.statusCode = 405;
    res.end("Use POST for this stateless MCP endpoint.");
    return;
  }
  let server;
  let transport;
  try {
    server = createServer();
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32600, message: `Invalid MCP request: ${error.message}` }, id: null }));
  } finally {
    // This trial is deliberately stateless: each completed request releases its server and transport.
    await server?.close();
    await transport?.close();
  }
}
