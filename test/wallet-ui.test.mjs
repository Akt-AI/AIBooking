import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
test('wallet page displays disabled checkout and only permits an eligible provider URL',async()=>{
 const dom=new JSDOM(await readFile(new URL('../public/wallet.html',import.meta.url),'utf8'),{url:'https://aibooking.store/wallet.html#'+'a'.repeat(32)});
 const originals=Object.fromEntries(['document','location','history','fetch'].map(key=>[key,globalThis[key]]));let mode='disabled',calls=[];
 Object.assign(globalThis,{document:dom.window.document,location:dom.window.location,history:dom.window.history,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('config')?{configured:mode!=='disabled',mode:'test'}:{id:'a'.repeat(32),amount:12345,description:'Agreed invoice',mode:'test',status:mode==='paid'?'paid':'created',checkoutUrl:mode==='evil'?'https://rzp.io.evil.example/i/x':'https://rzp.io/i/x',expiresAt:Math.floor(Date.now()/1000)+3600}};}});
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 try{
  await import('../public/wallet.js?disabled');await tick();let $=id=>document.getElementById(id);
  assert.match($('wallet-configuration').textContent,/not available yet/);assert.equal($('payment-checkout').hasAttribute('href'),false);assert.equal(location.hash,'');assert.match($('payment-amount').textContent,/123.45/);
  mode='evil';await import('../public/wallet.js?evil');$('payment-lookup').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();assert.equal($('payment-checkout').hasAttribute('href'),false);
  mode='paid';$('payment-lookup').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();assert.match($('payment-state').textContent,/confirmed by Razorpay/);assert.equal($('payment-checkout').hasAttribute('href'),false);assert.equal($('payment-refresh').disabled,true);
  assert.ok(calls.every(call=>call.options.cache==='no-store'));
 }finally{for(const [key,value]of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
});
