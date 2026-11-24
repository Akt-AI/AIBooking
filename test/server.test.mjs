import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../server.mjs';
const base='http://localhost';
async function fetch(url,options={}) {
 const headers=new Headers();let status=200,body;
 const response={setHeader(k,v){headers.set(k,v);},writeHead(code,extra={}){status=code;for(const [k,v]of Object.entries(extra))headers.set(k,v);},end(value){body=value;}};
 await handler({url:new URL(url).pathname+new URL(url).search,method:options.method||'GET'},response);
 return {status,headers,text:async()=>String(body??''),json:async()=>JSON.parse(String(body))};
}
test('serves app and security policy',async()=>{const r=await fetch(base);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await r.text(),/Your next step, sorted/);});
test('reports disconnected integrations honestly',async()=>{const r=await fetch(base+'/api/status');assert.deepEqual(await r.json(),{status:'ok',mode:'rail-information',railBooking:false,ap2Payments:false,railkitConfigured:Boolean(process.env.RAILKIT_API_KEY),aiConfigured:Boolean(process.env.GEMINI_API_KEY||process.env['GEMINI-API-KEY']),railMcpEnabled:true});});
test('never pretends to book or pay',async()=>{for(const route of ['book','pay','mandates']){const r=await fetch(base+'/api/'+route,{method:'POST',body:'{}'});assert.equal(r.status,503);assert.match((await r.json()).error,/No transaction/);}});
test('missing files and disallowed writes fail',async()=>{assert.equal((await fetch(base+'/missing')).status,404);assert.equal((await fetch(base+'/',{method:'POST'})).status,405);});
test('PWA assets are available',async()=>{for(const asset of ['/sw.js','/manifest.webmanifest','/icon.svg','/app.js','/style.css','/services.js','/bookings.js','/flights.html','/flights.js','/flights.css','/assistant-ui.js','/growth-ui.js','/admin.html','/admin.js','/wallet.html','/wallet.js'])assert.equal((await fetch(base+asset)).status,200);});

test('removed simulation assets cannot be served',async()=>{assert.equal((await fetch(base+'/simulation.js')).status,404);const html=await(await fetch(base)).text();assert.doesNotMatch(html,/Simulation mode|Simulate payment|demo booking|Booking assistant/);});

test('external scripts are restricted to the flight embed page',async()=>{
 const main=await fetch(base),widget=await fetch(base+'/flights.html');
 assert.match(main.headers.get('content-security-policy'),/script-src 'self';/);
 assert.doesNotMatch(main.headers.get('content-security-policy'),/widgets.skyscanner.net/);
 assert.match(widget.headers.get('content-security-policy'),/script-src 'self' https:\/\/widgets.skyscanner.net https:\/\/js.skyscnr.com;/);
 assert.match(widget.headers.get('content-security-policy'),/frame-ancestors 'self'/);
 const html=await main.text();assert.match(html,/id="flight-frame"/);assert.doesNotMatch(html,/<iframe[^>]+src=/);assert.match(html,/AIBooking does not receive your payment/);
});

test('wallet integration is discoverable and checkout configuration is separate from process health',async()=>{
 const html=await(await fetch(base)).text();assert.match(html,/href="\/wallet.html"/);
 const config=await(await fetch(base+'/api/payments/config')).json();assert.equal(config.provider,'Razorpay');assert.equal(config.storedBalance,false);
 const wallet=await fetch(base+'/wallet.html');assert.equal(wallet.headers.get('referrer-policy'),'no-referrer');assert.match(await wallet.text(),/name="referrer" content="no-referrer"/);
});
