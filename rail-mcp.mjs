import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {ListToolsRequestSchema,CallToolRequestSchema,McpError,ErrorCode} from '@modelcontextprotocol/sdk/types.js';
import {services,validateService} from './public/services.js';
const entries=Object.entries(services).filter(([id])=>id!=='pnr');
const toolName=id=>'rail_'+id.replaceAll('-','_');
function inputSchema(service){return {type:'object',properties:Object.fromEntries(Object.entries(service.fields).map(([name,f])=>[name,{type:'string',description:f.label+(f.kind==='date'?' (YYYY-MM-DD, IST)':''),...(f.options?{enum:Object.keys(f.options)}:{}),...(f.default?{default:f.default}:{}),...(f.kind==='train'?{pattern:'^[0-9]{5}$'}:{}),...(f.kind==='code'?{pattern:'^[A-Za-z0-9]{1,5}$'}:{})}])),required:Object.entries(service.fields).filter(([,f])=>!f.optional&&!f.default).map(([name])=>name),additionalProperties:false};}
export function createRailMCPServer({railkit}){
 const server=new Server({name:'aibooking-railkit',version:'1.0.0'},{capabilities:{tools:{}}});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:entries.map(([id,s])=>({name:toolName(id),description:s.title+': '+s.description+' Read-only RailKit information; no booking or payment.',inputSchema:inputSchema(s),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}}))}));
 server.setRequestHandler(CallToolRequestSchema,async request=>{
  const entry=entries.find(([id])=>toolName(id)===request.params.name);if(!entry)throw new McpError(ErrorCode.InvalidParams,'Unsupported rail information tool.');
  const [service]=entry;let params;try{params=validateService(service,request.params.arguments||{});}catch(error){throw new McpError(ErrorCode.InvalidParams,error.message);}
  let status,body;await railkit(new URL('http://internal/api/railkit?'+new URLSearchParams({type:service,...params})),{setHeader(){},writeHead(code){status=code;},end(value){body=JSON.parse(value);}});
  const payload={service,params,status,via:'MCP',...body};
  return {content:[{type:'text',text:JSON.stringify(payload)}],structuredContent:payload,isError:status>=400};
 });
 return server;
}
// The deployed bot uses a genuine MCP client/server pair without opening a public port.
export function createRailMCPBridge({railkit}){
 let ready;
 async function connect(){
  if(!ready)ready=(async()=>{const server=createRailMCPServer({railkit}),client=new Client({name:'aibooking-gemini',version:'1.0.0'});const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();await server.connect(serverTransport);await client.connect(clientTransport);return {server,client};})().catch(error=>{ready=undefined;throw error;});
  return ready;
 }
 return {
  async listTools(){return (await connect()).client.listTools();},
  async query(service,params){if(!entries.some(([id])=>id===service))throw Error('This rail service is not exposed through MCP.');const {client}=await connect();const result=await client.callTool({name:toolName(service),arguments:params},undefined,{timeout:25000});const payload=result.structuredContent||JSON.parse(result.content.find(c=>c.type==='text').text);const {status,...body}=payload;return {service,params:payload.params,code:status,body};},
  async close(){if(ready){const {client}=await ready;await client.close();ready=undefined;}}
 };
}
