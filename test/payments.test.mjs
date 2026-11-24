import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHmac,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStore} from '../storage.mjs';
import {createPayments,checkoutURL,validatePayment} from '../payments.mjs';
const adminToken='test-admin-payment-token-123456789',secret='test-webhook-secret';
async function request(handler,url,{method='GET',data,raw,auth,headers={}}={}){
 const body=raw??(data?JSON.stringify(data):'');const req=Readable.from(body?[body]:[]);Object.assign(req,{method,headers:{origin:'https://aibooking.store','content-type':'application/json',...(auth?{authorization:'Bearer '+auth}:{}),...headers},socket:{remoteAddress:'local'}});let status,output;
 await handler(req,{setHeader(){},writeHead(code){status=code;},end(text){output=JSON.parse(text);}},new URL('http://local'+url));return {status,body:output};
}
function fixture({fail=false}={}){
 const store=createStore();let entity,calls=0;const fetchFn=async(url,options)=>{calls++;assert.equal(new URL(url).hostname,'api.razorpay.com');assert.match(options.headers.Authorization,/^Basic /);if(fail)throw Error('do not expose provider credentials');if(options.body){const input=JSON.parse(options.body);assert.deepEqual(input.notify,{email:false,sms:false});assert.equal(input.reminder_enable,false);assert.equal(input.accept_partial,false);assert.equal(input.options.checkout.method.wallet,true);entity={...input,id:'plink_test123',amount_paid:0,status:'created',short_url:'https://rzp.io/i/test'};}return {ok:true,json:async()=>({...entity})};};
 const handler=createPayments({store,enabled:true,keyId:'rzp_test_example',keySecret:'test-secret-key',webhookSecret:secret,adminToken,fetchFn});
 return {store,handler,entity:()=>entity,calls:()=>calls,create:async()=>request(handler,'/api/admin/payment-requests',{method:'POST',auth:adminToken,data:{amount:12345,description:'Agreed placement invoice TEST',requestKey:randomUUID()}})};
}
test('payment activation and admin access fail closed without issuing a request',async()=>{
 const store=createStore();let calls=0;const handler=createPayments({store,enabled:false,adminToken,fetchFn:async()=>calls++});
 assert.equal((await request(handler,'/api/payments/config')).body.configured,false);
 assert.equal((await request(handler,'/api/admin/payment-requests')).status,401);
 assert.equal((await request(handler,'/api/admin/payment-requests',{method:'POST',auth:adminToken,data:{}})).status,503);
 assert.equal(calls,0);assert.equal(store.payments().length,0);store.close();
});
test('payment amounts and checkout destinations reject tampering',()=>{
 const good={amount:100,description:'Agreed service',requestKey:randomUUID()};
 for(const amount of [0,-1,99,1.2,'100',10000001,Infinity])assert.throws(()=>validatePayment({...good,amount}));
 for(const url of ['javascript:alert(1)','http://rzp.io/i/id','https://rzp.io.evil.test/id','https://user@rzp.io/id','https://rzp.io:444/id'])assert.throws(()=>checkoutURL(url));
 assert.equal(checkoutURL('https://rzp.io/i/id'),'https://rzp.io/i/id');
});
test('admin creates one provider request per idempotency key and public reads do not imply payment',async()=>{
 const f=fixture(),data={amount:10000,description:'Agreed service invoice',requestKey:randomUUID()};
 const first=await request(f.handler,'/api/admin/payment-requests',{method:'POST',data,auth:adminToken});assert.equal(first.status,201);assert.equal(first.body.mode,'test');assert.equal(first.body.status,'created');
 const retry=await request(f.handler,'/api/admin/payment-requests',{method:'POST',data,auth:adminToken});assert.equal(retry.body.id,first.body.id);assert.equal(f.calls(),1);
 assert.equal((await request(f.handler,'/api/admin/payment-requests',{method:'POST',data:{...data,amount:20000},auth:adminToken})).status,409);
 const publicRead=await request(f.handler,'/api/payments/requests/'+first.body.id+'?status=paid&razorpay_signature=fake');assert.equal(publicRead.body.status,'created');assert.doesNotMatch(JSON.stringify(publicRead.body),/provider_id|request_key|secret/);
 assert.equal((await request(f.handler,'/api/admin/payment-requests',{auth:adminToken,headers:{origin:'https://evil.test'}})).status,403);f.store.close();
});
test('ambiguous provider creation is retained and never retried as a new provider link',async()=>{
 const f=fixture({fail:true}),data={amount:10000,description:'Agreed service invoice',requestKey:randomUUID()};
 const first=await request(f.handler,'/api/admin/payment-requests',{method:'POST',data,auth:adminToken});assert.equal(first.status,502);assert.doesNotMatch(first.body.error,/credentials/);
 const retry=await request(f.handler,'/api/admin/payment-requests',{method:'POST',data,auth:adminToken});assert.equal(retry.body.status,'creation_unknown');assert.equal(retry.body.checkoutUrl,null);assert.equal(f.calls(),1);f.store.close();
});
test('webhooks validate exact raw signatures, amount, reference and mode; duplicate paid events are harmless',async()=>{
 const f=fixture(),created=await f.create(),id=created.body.id;
 async function webhook(entity,signatureOverride){const raw=JSON.stringify({event:'payment_link.paid',payload:{payment_link:{entity}}});const signature=createHmac('sha256',secret).update(raw).digest('hex');return request(f.handler,'/api/payments/webhook',{method:'POST',raw,headers:{'x-razorpay-signature':signatureOverride??signature}});}
 const paid={...f.entity(),status:'paid',amount_paid:12345};
 assert.equal((await webhook(paid,'0'.repeat(64))).status,401);assert.equal(f.store.payment(id).status,'created');
 assert.equal((await webhook({...paid,amount_paid:1})).status,400);
 assert.equal((await webhook({...paid,amount:100})).status,400);
 assert.equal((await webhook({...paid,id:'plink_other'})).status,400);
 const liveHandler=createPayments({store:f.store,enabled:true,keyId:'rzp_live_example',keySecret:'test-secret-key',webhookSecret:secret,adminToken});
 const crossMode=JSON.stringify({event:'payment_link.paid',payload:{payment_link:{entity:paid}}});
 assert.equal((await request(liveHandler,'/api/payments/webhook',{method:'POST',raw:crossMode,headers:{'x-razorpay-signature':createHmac('sha256',secret).update(crossMode).digest('hex')}})).body.ignored,true);assert.equal(f.store.payment(id).status,'created');
 assert.equal((await webhook(paid)).status,200);const updated=f.store.payment(id).updated;
 assert.equal((await webhook(paid)).status,200);assert.equal(f.store.payment(id).updated,updated);
 f.store.paymentStatus(id,'expired');assert.equal(f.store.payment(id).status,'paid');
 const forged=JSON.stringify({event:'payment_link.paid',payload:{payment_link:{entity:paid}}});assert.equal((await request(f.handler,'/api/payments/webhook',{method:'POST',raw:forged+' ',headers:{'x-razorpay-signature':createHmac('sha256',secret).update(forged).digest('hex')}})).status,401);f.store.close();
});
test('refresh verifies with the provider and terminal states cannot regress',async()=>{
 const f=fixture(),created=await f.create(),id=created.body.id;Object.assign(f.entity(),{status:'paid',amount_paid:12345});
 assert.equal((await request(f.handler,'/api/payments/requests/'+id+'/refresh',{method:'POST'})).body.status,'paid');
 Object.assign(f.entity(),{status:'created',amount_paid:0});assert.equal((await request(f.handler,'/api/payments/requests/'+id+'/refresh',{method:'POST'})).body.status,'paid');f.store.close();
});
test('payment ledger metadata survives reopening SQLite and paid status is immutable',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'aibooking-payments-')),file=path.join(dir,'app.sqlite');let store=createStore(file);
 try{store.addPayment({id:'a'.repeat(32),requestKey:randomUUID(),amount:100,description:'Agreed invoice',mode:'test',expires:123});store.attachPayment('a'.repeat(32),'plink_saved','https://rzp.io/i/test');store.paymentStatus('a'.repeat(32),'paid');store.close();store=createStore(file);assert.equal(store.payment('a'.repeat(32)).status,'paid');store.paymentStatus('a'.repeat(32),'created');assert.equal(store.payment('a'.repeat(32)).status,'paid');}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
