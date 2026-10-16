import { createServer as createHttpServer } from "node:http";
import handler from "./api/mcp.js";

const port = Number(process.env.PORT || 8787);
createHttpServer(handler).listen(port, () => console.log(`Fictional Re-New MCP trial listening on http://localhost:${port}/api/mcp`));
