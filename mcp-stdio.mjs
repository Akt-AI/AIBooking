import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createRailkitHandler} from './railkit.mjs';
import {createRailMCPServer} from './rail-mcp.mjs';
// stdout is reserved for MCP protocol messages. No app, chat or admin credentials are exposed.
const server=createRailMCPServer({railkit:createRailkitHandler()});
await server.connect(new StdioServerTransport());
