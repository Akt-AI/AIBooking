import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './storage.mjs';
import { createCommerce } from './commerce.mjs';
import { createRailMCPBridge } from './rail-mcp.mjs';
import { createAssistant } from './assistant.mjs';
import { json } from './http-utils.mjs';
import { createRailkitHandler } from './railkit.mjs';
const railkit = createRailkitHandler();
const store = createStore(process.env.DATA_DIR ? path.join(process.env.DATA_DIR,'aibooking.sqlite') : ':memory:');
const commerce = createCommerce({store});
const railMCP = createRailMCPBridge({railkit});
const assistant = createAssistant({store,railkit,railQuery:railMCP.query});
const rateLimits = new Map();
const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
export async function handler(req,res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const url = new URL(req.url,'http://localhost');
  if (url.pathname === '/flights.html') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://widgets.skyscanner.net https://js.skyscnr.com; style-src 'self' 'unsafe-inline' https://css.skyscnr.com; img-src 'self' data: https://*.skyscanner.net https://*.skyscnr.com; connect-src https://widgets.skyscanner.net https://www.skyscanner.net https://www.skyscanner.com; frame-src https://widgets.skyscanner.net; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action https://www.skyscanner.net https://www.skyscanner.co.in https://www.skyscanner.com");
  }
  if (url.pathname === '/api/assistant') return assistant(req,res);
  if (url.pathname === '/api/commerce' || url.pathname === '/api/partner-enquiries' || url.pathname.startsWith('/api/admin/') || url.pathname.startsWith('/go/')) return commerce(req,res,url);
  if (url.pathname === '/api/status') {
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({status:'ok',mode:'rail-information',railBooking:false,ap2Payments:false,railkitConfigured:Boolean(process.env.RAILKIT_API_KEY),aiConfigured:Boolean(process.env.GEMINI_API_KEY||process.env['GEMINI-API-KEY']),railMcpEnabled:true}));
  }
  if (url.pathname === '/api/railkit') {
    if (req.method !== 'GET') {res.writeHead(405);return res.end();}
    const now=Date.now(), ip=req.socket?.remoteAddress || 'local';
    for(const [key,entry] of rateLimits)if(entry.reset<=now)rateLimits.delete(key);
    const entry=rateLimits.get(ip)||{count:0,reset:now+60000};
    if(entry.count>=20||rateLimits.size>10000){res.writeHead(429,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Too many information requests. Try again in a minute.'}));}
    entry.count++;rateLimits.set(ip,entry);
    return railkit(url,res);
  }
  if (url.pathname.startsWith('/api/')) { res.writeHead(503,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'Ticket booking and payments are not available through AIBooking. No transaction has been made.'})); }
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405); return res.end();}
  try {
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root,'.'+name);
    if (!file.startsWith(root)) throw Error();
    const body = await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {res.writeHead(404);res.end('Not found');}
}
export const server = http.createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent)json(res,500,{error:'The service is temporarily unavailable.'});else res.end();});});
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT || 3000),process.env.HOST || '0.0.0.0',()=>console.log('AIBooking listening on http://localhost:'+ (process.env.PORT || 3000)));
