const $=id=>document.getElementById(id);let configured=false,reference='',requestVersion=0;
const states={creating:'Payment request is being prepared.',created:'Awaiting payment',paid:'Payment confirmed by Razorpay. Service fulfilment is handled separately.',cancelled:'This payment request was cancelled.',expired:'This payment request has expired.',creation_unknown:'Request creation needs review by AIBooking. Do not make a second payment.'};
async function api(path,method='GET'){const response=await fetch('/api/payments/'+path,{method,cache:'no-store',referrerPolicy:'no-referrer'});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load this request.');return data;}
function render(data){
 $('payment-detail').classList.remove('hidden');$('payment-description').textContent=data.description;$('payment-amount').textContent=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(data.amount/100);$('payment-mode').textContent=data.mode==='test'?'TEST MODE · No real payment':'LIVE PAYMENT';$('payment-state').textContent=states[data.status]||'Awaiting verification';$('payment-expiry').textContent='Request expires '+new Date(data.expiresAt*1000).toLocaleString('en-IN');
 const link=$('payment-checkout');link.classList.add('hidden');link.removeAttribute('href');
 if(configured&&data.status==='created'&&data.expiresAt*1000>Date.now()&&data.checkoutUrl){try{const u=new URL(data.checkoutUrl);if(u.protocol==='https:'&&u.hostname==='rzp.io'&&!u.username&&!u.password&&!u.port){link.href=u.href;link.classList.remove('hidden');}}catch{}}
 $('payment-refresh').disabled=!configured||['paid','creation_unknown','creating'].includes(data.status);
}
async function load(refresh=false){
 const current=$('payment-reference').value.trim().toLowerCase(),version=++requestVersion;
 if(!/^[a-f0-9]{32}$/.test(current)){$('payment-message').textContent='Enter a valid 32-character reference.';return;}
 reference=current;$('payment-message').textContent=refresh?'Verifying with Razorpay…':'Loading request…';$('payment-detail').classList.add('hidden');$('payment-refresh').disabled=true;
 try{const data=await api('requests/'+reference+(refresh?'/refresh':''),refresh?'POST':'GET');if(version!==requestVersion)return;render(data);$('payment-message').textContent='';}catch(error){if(version===requestVersion)$('payment-message').textContent=error.message;}
}
$('payment-lookup').addEventListener('submit',event=>{event.preventDefault();load();});$('payment-refresh').addEventListener('click',()=>load(true));
$('payment-reference').addEventListener('input',()=>{requestVersion++;$('payment-detail').classList.add('hidden');$('payment-message').textContent='';});
try{const config=await api('config');configured=config.configured;$('wallet-configuration').textContent=configured?(config.mode==='test'?'Test checkout is configured. No real money is collected.':'Secure checkout is available for issued service requests.'):'Payments are not available yet. Please wait for AIBooking to activate its payment provider.';}catch{$('wallet-configuration').textContent='Payment availability could not be checked. Please try later.';}
const fromLink=location.hash.slice(1);if(/^[a-f0-9]{32}$/.test(fromLink)){$('payment-reference').value=fromLink;history.replaceState(null,'',location.pathname);load();}
