import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('standalone MCP stdio entrypoint performs initialization and tool discovery without provider calls',async()=>{const client=new Client({name:'aibooking-stdio-test',version:'1.0.0'});const transport=new StdioClientTransport({command:process.execPath,args:['mcp-stdio.mjs'],env:{PATH:process.env.PATH},stderr:'pipe'});try{await client.connect(transport);const {tools}=await client.listTools();assert.equal(tools.length,14);assert.ok(tools.some(t=>t.name==='rail_search'));}finally{await client.close();}});
