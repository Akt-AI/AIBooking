export function setupAssistant({openService,openBookings,runService,sourceLink}){
 const dialog=document.getElementById('ai-dialog'),log=document.getElementById('ai-messages'),form=document.getElementById('ai-form'),input=document.getElementById('ai-message'),send=document.getElementById('ai-send');
 let history=[],busy=false,context=null,controller=null,sequence=0,opener=null;
 const node=(tag,text='',cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 const prompts=['Find trains from NDLS to HWH tomorrow','Help me send a parcel abroad','Compare movie booking options','Jio recharge kaise karun?'];
 function welcome(){log.replaceChildren();const bubble=node('div','','ai-bubble ai-assistant');bubble.append(node('span','AIBOOKING AI','ai-speaker'),node('p','Tell me what you want to do. I can check live rail information, help plan a journey, or point you to the right service.'));const chips=node('div','','ai-prompts');for(const prompt of prompts){const b=node('button',prompt,'ai-prompt');b.type='button';b.addEventListener('click',()=>ask(prompt));chips.append(b);}bubble.append(chips);log.append(bubble);}
 function open(prompt,ctx){opener=document.activeElement;context=ctx||null;if(!dialog.open)dialog.showModal();input.focus();if(prompt)ask(prompt);}
 function close(){dialog.close();opener?.focus?.();}
 function append(role,text){const bubble=node('div','',`ai-bubble ai-${role}`);bubble.append(node('span',role==='user'?'YOU':'AIBOOKING AI','ai-speaker'),node('p',text));log.append(bubble);log.scrollTop=log.scrollHeight;return bubble;}
 async function ask(message){
  if(busy||message.trim().length<2)return;message=message.trim().slice(0,1200);busy=true;send.disabled=true;input.value='';const seq=++sequence;controller=new AbortController();
  append('user',message);const loading=append('assistant','Checking how I can help…');loading.setAttribute('aria-busy','true');
  try{
   const payload={message,history:history.slice(-6),context};while(new TextEncoder().encode(JSON.stringify(payload)).length>10000&&payload.history.length)payload.history.splice(0,2);const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const result=await response.json();if(seq!==sequence)return;
   if(!response.ok)throw Error(result.error||'The AI guide is unavailable.');loading.remove();
   const bubble=append('assistant',result.reply);history.push({role:'user',text:message.slice(0,1200)},{role:'assistant',text:result.reply.slice(0,1200)});history=history.slice(-6);context=null;
   if(result.live){bubble.append(node('p',result.live.available?`RailKit data retrieved ${new Date(result.live.retrievedAt).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})} IST · ${result.source==='Gemini'?'AI summary':'Live source results'}`:'Live rail information was not available for those details.','ai-source'));}
   if(result.actions?.length){const actions=node('div','','ai-actions');for(const a of result.actions){
    if(a.kind==='provider'){const link=node('a',a.label+' ↗','ai-action');link.href=sourceLink(a.target,'assistant');link.target='_blank';link.rel='noopener noreferrer'+(a.affiliate||a.sponsored?' sponsored':'');if(a.affiliate||a.sponsored)link.append(node('span',a.sponsored?' · Sponsored':' · Affiliate link','ai-link-disclosure'));actions.append(link);}
    else{const b=node('button',a.label,'ai-action');b.type='button';b.addEventListener('click',()=>{close();if(a.kind==='booking')openBookings(a.target);else{openService(a.target,a.params);if(result.live?.available&&result.live.service===a.target)runService(a.target,result.live.params);}});actions.append(b);}
   }bubble.append(actions);}
   if(result.followups?.length){const follow=node('div','','ai-prompts');for(const text of result.followups){const b=node('button',text,'ai-prompt');b.type='button';b.addEventListener('click',()=>ask(text));follow.append(b);}bubble.append(follow);}
  }catch(error){if(seq!==sequence)return;loading.remove();append('assistant',error.name==='AbortError'?'This request was stopped. You can try again.':error.message);}
  finally{if(seq===sequence){busy=false;send.disabled=false;log.scrollTop=log.scrollHeight;input.focus();}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();ask(input.value);});input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
 document.getElementById('ai-close').addEventListener('click',close);
 document.getElementById('ai-clear').addEventListener('click',()=>{sequence++;controller?.abort();busy=false;send.disabled=false;history=[];context=null;welcome();input.focus();});
 document.getElementById('ai-launcher').addEventListener('click',()=>open());document.getElementById('ai-hero-form').addEventListener('submit',e=>{e.preventDefault();const value=document.getElementById('ai-hero-message').value.trim();if(value){open(value);document.getElementById('ai-hero-message').value='';}});
 document.querySelectorAll('[data-ai-prompt]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.aiPrompt)));
 document.querySelectorAll('[data-open-ai]').forEach(b=>b.addEventListener('click',()=>open()));
 welcome();return {open};
}
