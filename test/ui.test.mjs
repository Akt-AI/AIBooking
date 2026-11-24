import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const settle=async(check)=>{for(let i=0;i<40;i++){if(check())return;await new Promise(setImmediate);}assert.fail('UI did not reach expected state');};
test('application initializes, saves shortcuts, chats with safe actions, discloses sponsors and submits consented enquiries',async()=>{
 const dom=new JSDOM(await readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://aibooking.store/'}),{window}=dom;
 const saved=new Map();const globals=['window','document','history','location','localStorage','Option','FormData','navigator','fetch'];for(const key of globals)saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
 for(const key of globals.filter(k=>k!=='fetch'))Object.defineProperty(globalThis,key,{value:key==='window'?window:window[key],configurable:true,writable:true});
 window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=()=>{};window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const calls=[];globalThis.fetch=async(url,options={})=>{calls.push({url,options});let data;
  if(url==='/api/status')data={railkitConfigured:true,aiConfigured:true};
  else if(url==='/api/commerce')data={placements:[{provider:'booking',affiliate:true,sponsored:true}]};
  else if(url==='/api/assistant')data={reply:'You can review international shipping options.',actions:[{kind:'booking',target:'international-shipping',label:'International shipments',params:{}}],followups:[],live:null};
  else if(url==='/api/partner-enquiries')data={message:'Your enquiry has been saved for review.',id:'test-enquiry'};
  else throw Error('Unexpected fetch '+url);
  return {ok:true,json:async()=>data};
 };
 try{
  await import('../public/app.js?ui-regression');const $=id=>window.document.getElementById(id);
  await settle(()=>$('sponsored-list').children.length===1);assert.equal(window.document.querySelectorAll('.dashboard-card-wrap').length,6);window.document.querySelector('[data-directory]').click();assert.equal(window.document.querySelectorAll('.dashboard-card-wrap').length,6);assert.equal($('catalog-page').textContent,'1 / 3');$('catalog-next').click();assert.equal($('catalog-page').textContent,'2 / 3');window.document.querySelector('[data-daily]').click();assert.equal(window.document.querySelectorAll('.dashboard-card-wrap').length,6);window.document.querySelector('[data-home]').click();assert.equal($('sponsored-section').classList.contains('hidden'),false);
  window.document.querySelector('.service-card-wrap .save-shortcut').click();assert.equal($('shortcuts').classList.contains('hidden'),false);assert.equal(JSON.parse(window.localStorage.getItem('aibooking-shortcuts'))[0].kind,'rail');
  $('ai-hero-message').value='Send a parcel abroad';$('ai-hero-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle(()=>window.document.querySelector('.ai-actions .ai-action'));assert.equal($('ai-dialog').open,true);assert.match($('ai-messages').textContent,/international shipping options/);window.document.querySelector('.ai-actions .ai-action').click();assert.equal($('ai-dialog').open,false);assert.match($('booking-title').textContent,/further/);assert.equal($('booking-view').classList.contains('hidden'),false);
  window.document.querySelector('[data-partners]').click();assert.equal($('partners-view').classList.contains('hidden'),false);const form=$('partner-form');for(const [key,value]of Object.entries({company:'Example business',email:'team@example.invalid',message:'Discuss an affiliate partnership.'}))form.elements[key].value=value;form.elements.consent.checked=true;form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await settle(()=>$('partner-status').textContent.includes('test-enquiry'));assert.equal(JSON.parse(calls.find(c=>c.url==='/api/partner-enquiries').options.body).consent,true);
  assert.equal(calls.filter(c=>c.url==='/api/assistant').length,1);assert.doesNotMatch($('ai-messages').innerHTML,/<script>/);
 }finally{for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];dom.window.close();}
});
