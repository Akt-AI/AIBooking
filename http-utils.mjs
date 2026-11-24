import {isIP} from 'node:net';
import {timingSafeEqual} from 'node:crypto';
export function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export async function readJSON(req,max=12000){
 if(!String(req.headers?.['content-type']||'').startsWith('application/json'))throw Object.assign(Error('Use application/json.'),{status:415});
 const chunks=[];let size=0;
 for await(const chunk of req){const buffer=Buffer.from(chunk);size+=buffer.length;if(size>max)throw Object.assign(Error('Request is too large.'),{status:413});chunks.push(buffer);}
 try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data;}catch{throw Object.assign(Error('Send a valid JSON object.'),{status:400});}
}
export function sameOrigin(req){const origin=req.headers?.origin;return !origin||['https://aibooking.store','https://www.aibooking.store','http://localhost:3000','http://127.0.0.1:3000'].includes(origin);}
export function authorized(req,token){if(!token||token.length<24)return false;const provided=String(req.headers?.authorization||'').replace(/^Bearer /,'');const a=Buffer.from(provided),b=Buffer.from(token);return a.length===b.length&&timingSafeEqual(a,b);}
export function clientIP(req){const direct=req.socket?.remoteAddress||'local';if(process.env.TRUST_PROXY==='true'){const ip=String(req.headers?.['x-forwarded-for']||'').split(',').at(-1)?.trim();if(isIP(ip))return ip;}return direct;}
export function createLimiter(){const buckets=new Map();return (key,max,windowMs)=>{const now=Date.now();for(const [k,v]of buckets)if(v.expires<=now)buckets.delete(k);const item=buckets.get(key)||{count:0,expires:now+windowMs};if(item.count>=max||buckets.size>10000)return false;item.count++;buckets.set(key,item);return true;};}
