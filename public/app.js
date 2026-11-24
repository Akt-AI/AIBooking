import {setupAssistant} from './assistant-ui.js';
import {setupGrowth} from './growth-ui.js';
import {services,validateService,istDate,shiftDate,dateBounds} from './services.js';
import {bookingCategories,bookingProviders,bookingGroups,providerLink} from './bookings.js';
const $=id=>document.getElementById(id);
const el=(tag,text='',className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const action=(text,callback,className='secondary')=>{const b=el('button',text,className);b.type='button';b.addEventListener('click',callback);return b;};
let active='search',requestController=null,requestId=0,restoringRoute=false;
function setRoute(hash){if(!restoringRoute&&location.hash!==hash)history.pushState(null,'',hash);}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),4000);}
function abortRequest(){requestController?.abort();requestId++;}
let homeGroup='popular',homePage=0;
function snapTop(){ $('workspace').scrollTo?.({top:0,behavior:'instant'}); }
function closeMenu(){document.body.classList.remove('menu-open');$('menu-overlay').classList.add('hidden');$('menu-toggle').setAttribute('aria-expanded','false');}
function markNavigation(group,title){closeMenu();$('page-breadcrumb').textContent=title;const selectors={popular:'[data-home]',rail:'[data-directory]',travel:'[data-bookings]',daily:'[data-daily]',partners:'[data-partners]'};document.querySelectorAll('.sidebar-nav .nav,.mobile-dock a').forEach(n=>{const active=n.matches(selectors[group]||'none');n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});}
function home(directory=false){abortRequest();$('partners-view').classList.add('hidden');$('booking-view').classList.add('hidden');$('explore').classList.remove('hidden');$('service-view').classList.add('hidden');const group=directory==='daily'?'daily':directory==='travel'?'travel':directory?'rail':'popular';renderDashboard(group);setRoute(({popular:'#explore',rail:'#services',travel:'#bookings',daily:'#daily-services'})[group]);snapTop();}
$('back-home').addEventListener('click',()=>home(true));
document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();home();}));
document.querySelectorAll('[data-directory]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();home(true);}));
function dashboardIcon(target){
 const paths={rail:'M7 3h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM5 11h14M8 22l2-3m4 0 2 3M8 15h.01M16 15h.01',flights:'m22 2-7 20-4-9-9-4Z M22 2 11 13',stays:'M3 18V7m0 7h18v4m0-4V9H9v5M3 9h6v5M3 18v3m18-3v3',buses:'M6 3h12l2 4v12H4V7Zm-2 8h16M7 16h.01M17 16h.01M7 19v3m10-3v3',cabs:'m4 10 2-6h12l2 6M3 10h18v9H3ZM6 19v3m12-3v3M6 14h.01M18 14h.01',activities:'m16 8-3 5-5 3 3-5Zm6 4a10 10 0 1 1-20 0 10 10 0 0 1 20 0',movies:'M3 5h18v14H3ZM7 5v14M17 5v14M3 9h4m-4 6h4m10-6h4m-4 6h4',concerts:'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm12-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3',recharge:'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 18h4',bills:'M6 2h12v20l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3',shipping:'m3 7 9-5 9 5v10l-9 5-9-5Zm0 0 9 5 9-5M12 12v10M7 4l10 6'};
 const key=target.includes('shipping')?'shipping':Object.hasOwn(bookingCategories,target)?target:'rail';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[key]||paths.rail);svg.append(path);return svg;
}
function renderDashboard(group='popular',page=0){
 homeGroup=group;homePage=page;
 const allRail=Object.entries(services).map(([target,item])=>({kind:'rail',target,title:item.title,description:item.short}));
 const allBookings=Object.entries(bookingCategories).map(([target,item])=>({kind:'booking',target,title:item.title,description:item.short||({flights:'Search and compare flights',stays:'Hotels, apartments and more',buses:'Routes, operators and seats',cabs:'Local rides and transfers',activities:'Tours and things to do'})[target],group:item.group}));
 const popular=[['rail','search'],['rail','pnr'],['rail','tracking'],['booking','flights'],['booking','recharge'],['booking','domestic-shipping']].map(([kind,target])=>[...allRail,...allBookings].find(i=>i.kind===kind&&i.target===target));
 const items=group==='rail'?allRail:group==='travel'?allBookings.filter(i=>i.group==='travel'):group==='daily'?allBookings.filter(i=>i.group!=='travel'):popular;
 const pageCount=Math.ceil(items.length/6);homePage=Math.max(0,Math.min(page,pageCount-1));$('service-grid').replaceChildren();
 for(const item of items.slice(homePage*6,homePage*6+6)){
  const wrapper=el('div','','dashboard-card-wrap'+(item.kind==='rail'?' service-card-wrap':''));const card=action('',()=>item.kind==='rail'?openService(item.target):openBookings(item.target),'dashboard-card');const icon=el('span','','dashboard-card-icon');icon.append(dashboardIcon(item.target));const text=el('div','','dashboard-card-text');text.append(el('h3',item.title),el('p',item.description));card.append(icon,text,el('span','›','card-chevron'));wrapper.append(card,growth.saveButton(item.kind,item.target));$('service-grid').append(wrapper);
 }
 $('catalog-title').textContent=({popular:'Make it happen.',rail:'Rail information, made simple.',travel:'Build the rest of your journey.',daily:'Little things. Consider them sorted.'})[group];
 $('catalog-count').textContent=items.length+(group==='rail'?' rail services':' services');$('catalog-page').textContent=`${homePage+1} / ${pageCount}`;$('catalog-pagination').classList.toggle('hidden',pageCount<=1);$('catalog-prev').disabled=homePage===0;$('catalog-next').disabled=homePage+1>=pageCount;$('catalog-select').value=group;
 document.querySelectorAll('[data-catalog]').forEach(b=>{b.classList.toggle('active',b.dataset.catalog===group);b.setAttribute('aria-pressed',String(b.dataset.catalog===group));});
 markNavigation(group,({popular:'Overview',rail:'Rail services',travel:'Travel booking',daily:'Daily services'})[group]);
}
document.querySelectorAll('[data-catalog]').forEach(b=>b.addEventListener('click',()=>home(b.dataset.catalog==='popular'?false:b.dataset.catalog==='rail'?true:b.dataset.catalog)));
$('catalog-select').addEventListener('change',()=>home($('catalog-select').value==='popular'?false:$('catalog-select').value==='rail'?true:$('catalog-select').value));
$('catalog-prev').addEventListener('click',()=>renderDashboard(homeGroup,homePage-1));$('catalog-next').addEventListener('click',()=>renderDashboard(homeGroup,homePage+1));
$('menu-toggle').addEventListener('click',()=>{const open=!document.body.classList.contains('menu-open');document.body.classList.toggle('menu-open',open);$('menu-overlay').classList.toggle('hidden',!open);$('menu-toggle').setAttribute('aria-expanded',String(open));});$('menu-overlay').addEventListener('click',closeMenu);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
$('dashboard-date').textContent=new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Kolkata'}).format(new Date());
function openService(type,preset={}){
 abortRequest();$('partners-view').classList.add('hidden');$('booking-view').classList.add('hidden');active=type;const service=services[type];
 $('explore').classList.add('hidden');$('service-view').classList.remove('hidden');$('results').classList.add('hidden');$('result-content').replaceChildren();
 $('service-title').textContent=service.title;$('service-category').textContent=service.category.toUpperCase()+' YOUR JOURNEY';$('service-description').textContent=service.description;
 $('service-note').textContent=type==='pnr'?'Your PNR is sent to RailKit to retrieve your reservation. Queries and passenger results are not saved by AIBooking.':'Information is retrieved from RailKit. Availability and timings can change; check again before travelling.';
 const form=$('service-form');form.replaceChildren();
 for(const [key,field]of Object.entries(service.fields)){
  const label=el('label',field.label+(field.optional?' (optional)':''));let input;
  if(field.kind==='select'){input=el('select');for(const [value,text]of Object.entries(field.options))input.append(new Option(`${text} · ${value}`,value));input.value=field.default||Object.keys(field.options)[0];}
  else{
   input=el('input');input.type=field.kind==='date'?'date':'text';input.autocomplete='off';input.spellcheck=false;
   if(field.placeholder)input.placeholder=field.placeholder;
   if(field.kind==='code'){input.maxLength=5;input.pattern='[A-Za-z0-9]{1,5}';input.setAttribute('list','station-codes');input.classList.add('station-code');}
   if(field.kind==='train'||field.kind==='pnr'){input.inputMode='numeric';input.maxLength=field.kind==='train'?5:10;input.pattern=field.kind==='train'?'[0-9]{5}':'[0-9]{10}';}
   if(field.kind==='name'){input.minLength=2;input.maxLength=80;}
   if(field.kind==='date'){Object.assign(input,dateBounds(field.range));if(!field.optional)input.value=field.range==='past'?shiftDate(istDate(),-1):istDate();}
  }
  input.name=key;input.id='field-'+key;input.required=!field.optional;
  if(preset[key]!==undefined)input.value=preset[key];
  label.append(input);if(field.hint)label.append(el('span',field.hint,'field-hint'));form.append(label);
 }
 const submit=el('button',type==='cancellations'?'Get cancelled trains':'Get '+service.title.toLowerCase(),'primary');submit.id='service-submit';form.append(submit);
 if(service.fields.from||service.fields.to||Object.values(service.fields).some(f=>f.kind==='code'))form.append(action('Find a station code',()=>openService('stations-name'),'inline-button station-help'));markNavigation('rail',service.title);setRoute('#'+type);snapTop();
}
$('service-form').addEventListener('submit',e=>{e.preventDefault();try{runService(active,validateService(active,Object.fromEntries(new FormData(e.currentTarget))));}catch(error){toast(error.message);}});
async function runService(type,params){
 abortRequest();const id=requestId;requestController=new AbortController();const controller=requestController;
 $('service-submit').disabled=true;$('results').classList.remove('hidden');$('result-content').replaceChildren(el('p','Retrieving '+services[type].title.toLowerCase()+'…','loading'));
 try{
  const timeout=setTimeout(()=>controller.abort('timeout'),25000);let response,result;
  try{response=await fetch('/api/railkit?'+new URLSearchParams({type,...params}),{cache:'no-store',signal:controller.signal});result=await response.json();}finally{clearTimeout(timeout);}
  if(id!==requestId)return;
  if(!response.ok)throw Error(result.error||'Rail information could not be retrieved.');
  const host=$('result-content');host.replaceChildren();
  const heading=el('div','','result-heading');heading.append(el('h2',services[type].title),el('p',`RailKit · Retrieved ${new Date(result.retrievedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST`,'result-meta'));host.append(heading);
  if(type==='search')renderSearch(result.data,params,host);else host.append(renderData(result.data));if(type!=='pnr')host.append(action('Ask AI to explain these results',()=>ai.open('Explain these railway results and help me choose the next step.',{service:type,params})));
 }catch(error){if(id!==requestId)return;const box=el('div','','notice error');box.setAttribute('role','alert');box.append(el('h3','Information unavailable'),el('p',controller.signal.aborted?'The request timed out. Please try again.':error.message),action('Try again',()=>runService(type,params)));$('result-content').replaceChildren(box);}
 finally{if(id===requestId)$('service-submit').disabled=false;}
}
function renderSearch(data,params,host){
 const trains=Array.isArray(data)?data:Array.isArray(data?.trains)?data.trains:null;
 if(!trains){host.append(renderData(data));return;}
 if(!trains.length){host.append(el('p','No direct trains were returned for this route and date. Try another station or journey date.','empty'),action('Explore flights and buses',()=>openBookings('buses')));return;}
 host.append(el('p',`${trains.length} trains returned · Check running days for your journey date.`,'muted'));
 appendPages(trains,host,train=>{
  const number=String(train.train_no||train.trainNo||train.number||''),name=train.train_name||train.trainName||train.name||'Train';
  const card=el('article','','train-card'),summary=el('div');summary.append(el('span',number,'train-number'),el('h3',name));
  const from=train.from_stn_name||train.source_stn_name||params.from,to=train.to_stn_name||train.dstn_stn_name||params.to;
  summary.append(el('p',`${from} to ${to}`,'muted'));
  const times=[train.from_time,train.to_time].filter(Boolean).join(' — ');if(times)summary.append(el('p',times,'train-times'));
  if(train.travel_time)summary.append(el('p',`Duration: ${train.travel_time}`,'muted'));
  const actions=el('div','','train-actions');
  if(/^\d{5}$/.test(number))for(const [type,text]of [['train','View route'],['availability','Check seats'],['fare','Check fare']])actions.append(action(text,()=>openService(type,{...params,value:number,date:params.date||istDate()})));
  const details=el('details');details.append(el('summary','Running days and more'),renderData(train));card.append(summary,actions,details);return card;
 });
}
function humanize(key){const labels={pnr:'PNR',train_no:'Train number',trainNo:'Train number',stnCode:'Station code',stnName:'Station',from_time:'Departure',to_time:'Arrival',travel_time:'Travel time',running_days:'Running days',lat:'Latitude',lon:'Longitude',gst:'GST'};return labels[key]||String(key).replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());}
function formatValue(key,value){
 if(value===null||value===undefined||value==='')return 'Not provided';
 if(typeof value==='boolean')return value?'Yes':'No';
 if(key==='running_days'&&/^[01]{7}$/.test(String(value)))return `${value} (provider running-day code)`;
 if(typeof value==='number'&&/fare|charge|reservation|superfast|catering|gst|concession/i.test(key))return `₹${value.toLocaleString('en-IN')}`;
 return String(value);
}
function appendPages(items,host,render){let offset=0;const more=action('Show more',add,'secondary show-more');function add(){const slice=items.slice(offset,offset+20);offset+=slice.length;for(const item of slice)host.insertBefore(render(item),more);more.hidden=offset>=items.length;more.textContent=`Show more (${items.length-offset} remaining)`;}host.append(more);add();}
function renderData(data,depth=0){
 const host=el('div','','rail-data');
 if(data===null||data===undefined){host.append(el('p','No information was returned for this query.','empty'));return host;}
 if(typeof data!=='object'){host.append(el('p',String(data)));return host;}
 if(depth>10){host.append(el('p','Additional nested provider details are not displayed.'));return host;}
 if(Array.isArray(data)){
  if(!data.length){host.append(el('p','No entries returned for these details.','empty'));return host;}
  appendPages(data,host,item=>{
   if(item&&typeof item==='object'){const details=el('details','','data-entry');details.open=depth<1;const name=item.stationName||item.stnName||item.trainName||item.train_name||item.name||item.code||item.date||item.stationCode||item.serialNumber;details.append(el('summary',String(name||'Details')),renderData(item,depth+1));return details;}
   return renderData(item,depth+1);
  });return host;
 }
 const facts=el('dl','','rail-facts');
 for(const [key,value]of Object.entries(data)){
  if(value!==null&&typeof value==='object'){const details=el('details');details.open=depth===0;details.append(el('summary',humanize(key)),renderData(value,depth+1));host.append(details);}
  else facts.append(el('dt',humanize(key)),el('dd',formatValue(key,value)));
 }
 if(facts.children.length)host.prepend(facts);return host;
}
function openBookings(category='flights'){
 abortRequest();$('partners-view').classList.add('hidden');$('explore').classList.add('hidden');$('service-view').classList.add('hidden');$('booking-view').classList.remove('hidden');
 const details=bookingCategories[category];$('booking-title').textContent=details.heading;$('booking-description').textContent=details.description;
 $('flight-search-panel').classList.toggle('hidden',category!=='flights');$('booking-tabs').replaceChildren();$('booking-group-tabs').replaceChildren();
 for(const [key,group]of Object.entries(bookingGroups)){const b=action(group.title,()=>openBookings(group.first),'booking-group');b.classList.toggle('active',key===details.group);b.setAttribute('aria-pressed',String(key===details.group));$('booking-group-tabs').append(b);}
 const help=$('booking-service-help');help.replaceChildren();help.classList.toggle('hidden',!details.notes);
 if(details.notes){help.open=false;help.append(el('summary',details.group==='shipping'?'What to prepare before shipping':'Useful information before you continue'));const list=el('ul');for(const note of details.notes)list.append(el('li',note));help.append(list);}

 for(const [key,tab]of Object.entries(bookingCategories)){if(tab.group!==details.group)continue;const b=action(tab.title,()=>openBookings(key),'filter');b.classList.toggle('active',key===category);b.setAttribute('aria-pressed',String(key===category));$('booking-tabs').append(b);}
 $('booking-provider-list').replaceChildren();
 for(const provider of bookingProviders.filter(p=>p.category===category)){
  const card=el('article','','booking-provider'),text=el('div');text.append(el('span',provider.mode==='app'?'PROVIDER APP REQUIRED':'CONTINUE ON PROVIDER SITE','provider-tag'),el('h2',provider.name),el('p',provider.description));
  const link=el('a',provider.label+' ↗','secondary');link.href=growth.sourceLink(provider.id);link.target='_blank';link.rel='noopener noreferrer';const controls=el('div','','provider-controls');controls.append(link,growth.saveButton('provider',provider.id));card.append(text,controls);growth.decorateProvider(card,provider.id);$('booking-provider-list').append(card);
 }
 markNavigation(details.group==='travel'?'travel':'daily',details.title);setRoute('#book-'+category);snapTop();
}
$('booking-back').addEventListener('click',()=>home());
document.querySelectorAll('[data-daily]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();home('daily');}));
document.querySelectorAll('[data-bookings]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();home('travel');}));
$('load-flights').addEventListener('click',()=>{const frame=$('flight-frame');frame.src='/flights.html';frame.classList.remove('hidden');$('load-flights').classList.add('hidden');});
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==$('flight-frame').contentWindow||event.data?.type!=='aibooking-flight-height')return;
 const height=event.data.height;if(typeof height==='number'&&Number.isFinite(height))$('flight-frame').height=String(Math.min(1600,Math.max(450,height)));
});
function openPartners(){abortRequest();$('explore').classList.add('hidden');$('service-view').classList.add('hidden');$('booking-view').classList.add('hidden');$('partners-view').classList.remove('hidden');markNavigation('partners','Business & partners');setRoute('#partners');snapTop();}
document.querySelector('[data-partner-back]').addEventListener('click',()=>home());
const growth=setupGrowth({openService,openBookings,openPartners,toast});
const ai=setupAssistant({openService,openBookings,runService,sourceLink:growth.sourceLink});
const savedDialog=$('shortcuts-dialog');document.querySelectorAll('[data-open-saved]').forEach(b=>b.addEventListener('click',()=>{closeMenu();savedDialog.showModal();}));$('saved-close').addEventListener('click',()=>savedDialog.close());
document.querySelectorAll('[data-open-ai]').forEach(b=>b.addEventListener('click',closeMenu));
renderDashboard();
function restoreRoute(){restoringRoute=true;try{const fragment=location.hash.slice(1);if(fragment==='partners')openPartners();else if(fragment==='daily-services')home('daily');else if(Object.hasOwn(services,fragment))openService(fragment);else if(fragment==='bookings')home('travel');else if(fragment==='services')home(true);else if(fragment.startsWith('book-')&&Object.hasOwn(bookingCategories,fragment.slice(5)))openBookings(fragment.slice(5));else home();}finally{restoringRoute=false;}}
window.addEventListener('popstate',restoreRoute);restoreRoute();
fetch('/api/status',{cache:'no-store'}).then(r=>r.json()).then(data=>{$('connection-status').textContent=data.railkitConfigured?'RailKit connected':'Rail information unavailable';}).catch(()=>{$('connection-status').textContent='Offline · reconnect to search';});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
