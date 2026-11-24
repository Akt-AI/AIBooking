import {bookingProviders,providerLink,bookingCategories} from './public/bookings.js';
import {istDate} from './public/services.js';
import {json,readJSON,sameOrigin,authorized,clientIP,createLimiter} from './http-utils.mjs';
export function validPlacement(data,allowedHosts=[]){
 const provider=bookingProviders.find(p=>p.id===data.provider);if(!provider)throw Error('Choose a listed provider.');
 let url;try{url=new URL(data.url||provider.url);}catch{throw Error('Enter a valid HTTPS URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||![new URL(provider.url).hostname,...allowedHosts].includes(url.hostname))throw Error('Use the provider’s HTTPS host or an explicitly approved affiliate network host.');
 if(url.href.length>2000||typeof data.affiliate!=='boolean'||typeof data.sponsored!=='boolean')throw Error('Invalid placement settings.');
 return {provider:provider.id,url:url.href,affiliate:data.affiliate,sponsored:data.sponsored};
}
export function validateLead(data){
 const company=String(data.company||'').trim(),email=String(data.email||'').trim(),message=String(data.message||'').trim(),interest=String(data.interest||'');
 if(data.website)throw Error('Submission could not be accepted.');
 if(company.length<2||company.length>100||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<10||message.length>2000||!['sponsorship','affiliate','business-concierge'].includes(interest)||data.consent!==true)throw Error('Enter your company, a valid business email, enquiry type and message, and agree to contact about this enquiry.');
 return {company,email,interest,message};
}
export function createCommerce({store,adminToken=process.env.ADMIN_TOKEN,allowedHosts=String(process.env.AFFILIATE_ALLOWED_HOSTS||'').split(',').map(s=>s.trim()).filter(Boolean)}={}){
 const limit=createLimiter();
 function placements(){return store.placements().filter(p=>{try{validPlacement({...p,affiliate:Boolean(p.affiliate),sponsored:Boolean(p.sponsored)},allowedHosts);return true;}catch{return false;}});}
 return async(req,res,url)=>{
  if(url.pathname==='/api/commerce'&&req.method==='GET')return json(res,200,{placements:placements().map(p=>({provider:p.provider,affiliate:Boolean(p.affiliate),sponsored:Boolean(p.sponsored)}))});
  if(url.pathname.startsWith('/go/')){
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
   const id=url.pathname.slice(4);let fallback;try{fallback=providerLink(id);}catch{return json(res,404,{error:'Unknown service provider.'});}
   const placement=placements().find(p=>p.provider===id),source=['directory','assistant','sponsored','saved'].includes(url.searchParams.get('source'))?url.searchParams.get('source'):'directory';
   if((placement?.affiliate||placement?.sponsored)&&url.searchParams.get('disclosed')!=='1'){
    const name=bookingProviders.find(p=>p.id===id).name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const next='/go/'+encodeURIComponent(id)+'?'+new URLSearchParams({source,disclosed:'1'});
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Continue to ${name} · AIBooking</title><link rel="stylesheet" href="/style.css"></head><body><main class="handoff-page"><p class="eyebrow">PROVIDER HANDOFF</p><h1>Continue to ${name}</h1>${placement.sponsored?'<p class="sponsor-badge">Sponsored placement</p>':''}${placement.affiliate?'<p>Affiliate link: AIBooking may earn a commission if you complete a qualifying action with this provider.</p>':''}<p>Prices, booking, payment and customer support are handled by the provider.</p><a class="primary" href="${next.replaceAll('&','&amp;')}">Continue to ${name}</a><p><a href="/">Return to AIBooking</a></p></main></body></html>`);
   }
   if(req.method==='GET'&&req.headers?.['sec-purpose']!=='prefetch'&&limit('click:'+clientIP(req),120,60000))store.click(istDate(),id,source);
   res.writeHead(302,{'Location':placement?.url||fallback,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
  }
  if(url.pathname==='/api/partner-enquiries'){
   if(req.method!=='POST')return json(res,405,{error:'Use POST.'});
   if(!sameOrigin(req))return json(res,403,{error:'Submit this form from AIBooking.'});
   if(!limit('lead:'+clientIP(req),3,3600000))return json(res,429,{error:'Too many enquiries. Please try again in an hour.'});
   let data;try{data=validateLead(await readJSON(req,5000));}catch(error){return json(res,error.status||400,{error:error.message});}
   try{const id=store.addLead(data);return json(res,201,{id,message:'Your enquiry has been saved for review. No payment has been taken.'});}catch{return json(res,503,{error:'Enquiries are temporarily unavailable. Please try again later.'});}
  }
  if(url.pathname.startsWith('/api/admin/')){
   if(!authorized(req,adminToken))return json(res,401,{error:'Administrator authentication required.'});
   if(!sameOrigin(req))return json(res,403,{error:'Origin not allowed.'});
   if(url.pathname==='/api/admin/report'&&req.method==='GET')return json(res,200,{...store.report(),providers:bookingProviders.map(({id,name,category,url})=>({id,name,category:bookingCategories[category].title,url}))});
   if(url.pathname==='/api/admin/placements'&&req.method==='POST'){
    try{const placement=validPlacement(await readJSON(req,4000),allowedHosts);store.place(placement);return json(res,200,{saved:true});}catch(error){return json(res,error.status||400,{error:error.message});}
   }
   if(url.pathname==='/api/admin/leads'&&req.method==='POST'){
    try{const data=await readJSON(req,1000);if(typeof data.id!=='string'||data.id.length>80||!['new','reviewed','closed'].includes(data.status))throw Error('Invalid enquiry update.');return json(res,store.updateLead(data.id,data.status)?200:404,{updated:true});}catch(error){return json(res,error.status||400,{error:error.message});}
   }
   return json(res,404,{error:'Unknown admin operation.'});
  }
  return json(res,404,{error:'Unknown operation.'});
 };
}
