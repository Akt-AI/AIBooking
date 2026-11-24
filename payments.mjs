import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {json,readJSON,sameOrigin,authorized,clientIP,createLimiter} from './http-utils.mjs';
const identifier=/^[a-f0-9]{32}$/;
const statuses=new Set(['created','paid','cancelled','expired']);
export function verifyWebhook(raw,signature,secret){
 if(!secret||!(/^[a-f0-9]{64}$/i.test(String(signature))))return false;
 return timingSafeEqual(Buffer.from(signature,'hex'),createHmac('sha256',secret).update(raw).digest());
}
export function checkoutURL(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='rzp.io'||url.port||url.username||url.password)throw Error('Invalid checkout destination.');
 return url.href;
}
export function validatePayment(input){
 const amount=input.amount,description=String(input.description||'').trim(),requestKey=String(input.requestKey||'');
 if(!Number.isSafeInteger(amount)||amount<100||amount>10000000)throw Error('Enter an amount from ₹1 to ₹100,000 in integer paise.');
 if(description.length<5||description.length>200||/[\x00-\x1f]/.test(description))throw Error('Describe the agreed AIBooking service in 5–200 characters.');
 if(!/^[a-f0-9-]{36}$/.test(requestKey))throw Error('Supply a unique request key.');
 return {amount,description,requestKey};
}
export function createPayments({store,keyId=process.env.RAZORPAY_KEY_ID,keySecret=process.env.RAZORPAY_KEY_SECRET,webhookSecret=process.env.RAZORPAY_WEBHOOK_SECRET,enabled=process.env.PAYMENTS_ENABLED==='true',adminToken=process.env.ADMIN_TOKEN,fetchFn=fetch}={}){
 const connected=Boolean(keyId&&keySecret&&webhookSecret),ready=Boolean(enabled&&connected),mode=keyId?.startsWith('rzp_live_')?'live':'test',limit=createLimiter(),inflight=new Set();
 const safe=row=>({id:row.id,amount:row.amount,currency:'INR',description:row.description,status:row.status,mode:row.mode,checkoutUrl:ready&&row.mode===mode&&row.status==='created'&&row.expires*1000>Date.now()?row.checkout_url:null,updatedAt:row.updated,expiresAt:row.expires});
 async function provider(path,body){
  const response=await fetchFn('https://api.razorpay.com/v1/payment_links'+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(keyId+':'+keySecret).toString('base64'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Payment provider unavailable.');
  return response.json();
 }
 function checkEntity(row,entity){
  if(entity.id!==row.provider_id||entity.reference_id!==row.id||entity.amount!==row.amount||entity.currency!=='INR'||!statuses.has(entity.status)||entity.accept_partial!==false)throw Error('Payment details do not match.');
  if(entity.status==='paid'&&entity.amount_paid!==row.amount)throw Error('Payment is not fully paid.');
  return entity.status;
 }
 return async(req,res,url)=>{
  res.setHeader('Referrer-Policy','no-referrer');
  if(url.pathname==='/api/payments/config'&&req.method==='GET')return json(res,200,{configured:ready,provider:'Razorpay',mode:ready?mode:null,storedBalance:false});
  if(url.pathname==='/api/payments/webhook'){
   if(req.method!=='POST')return json(res,405,{error:'Use POST.'});
   if(!connected)return json(res,503,{error:'Payment verification is not configured.'});
   const chunks=[];let size=0;
   for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>65536)return json(res,413,{error:'Request too large.'});chunks.push(b);}
   const raw=Buffer.concat(chunks);
   if(!verifyWebhook(raw,req.headers['x-razorpay-signature'],webhookSecret))return json(res,401,{error:'Invalid webhook signature.'});
   let event;try{event=JSON.parse(raw);}catch{return json(res,400,{error:'Invalid JSON.'});}
   if(!['payment_link.paid','payment_link.cancelled','payment_link.expired'].includes(event.event))return json(res,200,{received:true,ignored:true});
   const entity=event.payload?.payment_link?.entity,row=entity?.reference_id?store.payment(entity.reference_id):null;
   if(!row||row.mode!==mode)return json(res,200,{received:true,ignored:true});
   try{const status=checkEntity(row,entity);if(event.event!=='payment_link.'+status)throw Error();store.paymentStatus(row.id,status);return json(res,200,{received:true});}
   catch{return json(res,400,{error:'Webhook payment details do not match.'});}
  }
  const admin=url.pathname==='/api/admin/payment-requests';
  if(admin){
   if(!authorized(req,adminToken))return json(res,401,{error:'Administrator authentication required.'});
   if(!sameOrigin(req))return json(res,403,{error:'Origin not allowed.'});
   if(req.method==='GET')return json(res,200,{configured:ready,mode:ready?mode:null,requests:store.payments().map(safe)});
   if(req.method!=='POST')return json(res,405,{error:'Use GET or POST.'});
   if(!ready)return json(res,503,{error:'Configure and enable the payment provider before creating requests.'});
   let input;try{input=validatePayment(await readJSON(req,4000));}catch(error){return json(res,error.status||400,{error:error.message});}
   const previous=store.paymentByKey(input.requestKey);
   if(previous){if(previous.amount!==input.amount||previous.description!==input.description)return json(res,409,{error:'This request key belongs to different payment details.'});return json(res,200,safe(previous));}
   if(!limit('create:'+clientIP(req),10,60000))return json(res,429,{error:'Too many payment requests.'});
   const id=randomBytes(16).toString('hex'),expires=Math.floor(Date.now()/1000)+86400;
   store.addPayment({id,...input,mode,expires});
   try{
    const entity=await provider('',{amount:input.amount,currency:'INR',accept_partial:false,reference_id:id,description:input.description,expire_by:expires,notify:{sms:false,email:false},reminder_enable:false,options:{checkout:{method:{wallet:true}}}});
    if(!/^plink_[A-Za-z0-9]+$/.test(entity.id))throw Error();
    const checkout=checkoutURL(entity.short_url);
    checkEntity({...store.payment(id),provider_id:entity.id},entity);
    if(entity.status!=='created')throw Error();
    store.attachPayment(id,entity.id,checkout);
    return json(res,201,safe(store.payment(id)));
   }catch{store.paymentStatus(id,'creation_unknown');return json(res,502,{error:'The provider did not confirm request creation. Reuse the same request key; review this reference in Razorpay before creating another request.',id});}
  }
  const match=url.pathname.match(/^\/api\/payments\/requests\/([a-f0-9]{32})(\/refresh)?$/);
  if(!match)return json(res,404,{error:'Unknown payment endpoint.'});
  if(!identifier.test(match[1]))return json(res,404,{error:'Request not found.'});
  if(!sameOrigin(req))return json(res,403,{error:'Origin not allowed.'});
  if(req.method!==(match[2]?'POST':'GET'))return json(res,405,{error:'Method not allowed.'});
  if(!limit('read:'+clientIP(req),30,60000))return json(res,429,{error:'Please wait before checking again.'});
  const row=store.payment(match[1]);if(!row)return json(res,404,{error:'Request not found.'});
  if(!match[2])return json(res,200,safe(row));
  if(!connected||row.mode!==mode||!row.provider_id)return json(res,503,{error:'Payment verification is unavailable. Contact AIBooking support.'});
  if(inflight.has(row.id)||!limit('refresh:'+row.id,4,60000))return json(res,429,{error:'Please wait before refreshing this payment.'});
  inflight.add(row.id);
  try{const entity=await provider('/'+encodeURIComponent(row.provider_id));store.paymentStatus(row.id,checkEntity(row,entity));return json(res,200,safe(store.payment(row.id)));}
  catch{return json(res,502,{error:'Could not verify payment with Razorpay. Your saved status has not changed.'});}
  finally{inflight.delete(row.id);}
 };
}
