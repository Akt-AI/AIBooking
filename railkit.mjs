import {validateService} from './public/services.js';
const formatDate=value=>value?.split('-').reverse().join('-');
export const operations={
 train:['getTrainInfo',p=>[p.value]],station:['liveAtStation',p=>[p.value,Number(p.hours)]],pnr:['checkPNRStatus',p=>[p.value]],
 search:['searchTrainBetweenStations',p=>p.date?[p.from,p.to,formatDate(p.date)]:[p.from,p.to]],
 availability:['getAvailability',p=>[p.value,p.from,p.to,formatDate(p.date),p.travelClass,p.quota]],
 fare:['fareLookup',p=>[p.value,p.from,p.to,formatDate(p.date),p.travelClass,p.quota]],
 tracking:['trackTrain',p=>[p.value,formatDate(p.date)]],
 'tracking-v2':['trackTrainV2',p=>[p.value,formatDate(p.date)]],
 history:['getTrainHistory',p=>[p.value,formatDate(p.date)]],
 cancellations:['cancelList',()=>[]],
 'station-code':['stationByCode',p=>[p.value]],'stations-name':['stationsByName',p=>[p.value]],
 'train-number':['trainByNumber',p=>[p.value]],'trains-name':['trainsByName',p=>[p.value]],
 timetable:['trainTimetableAtStation',p=>p.date?[p.value,formatDate(p.date)]:[p.value]]
};
// SDK remains on the server. Credentials, PNRs and raw provider errors are never logged.
export function createRailkitHandler({key=process.env.RAILKIT_API_KEY,load=()=>import('railkit'),timeoutMs=20000}={}){
 let client;
 return async function railkit(url,res){
  res.setHeader('Cache-Control','no-store');
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  const type=url.searchParams.get('type');let params;
  try{params=validateService(type,Object.fromEntries(url.searchParams));}catch(error){return send(400,{error:error.message});}
  if(!key)return send(503,{error:'Rail information is temporarily unavailable. Please try again later.',source:'RailKit',configured:false});
  try{
   client??=Promise.resolve().then(load).then(sdk=>{sdk.configure(key);return sdk;}).catch(error=>{client=undefined;throw error;});
   const sdk=await client;const [method,args]=operations[type];
   if(typeof sdk[method]!=='function')return send(503,{error:'This service is not available from the installed provider. Please use another rail service.',source:'RailKit'});
   let timeout;
   const result=await Promise.race([sdk[method](...args(params)),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('timeout')),timeoutMs);})]).finally(()=>clearTimeout(timeout));
   if(!result||result.success!==true){
    const providerText=String(result?.error?.message||result?.error||result?.message||'');
    if(/rate|quota.*exceed|too many/i.test(providerText))return send(429,{error:'The rail information provider’s request limit has been reached. Please try again later.',source:'RailKit'});
    if(/not found|no (?:data|record|train|result)|not available/i.test(providerText))return send(404,{error:'No information was found for these details. Check your inputs or try another date.',source:'RailKit'});
    return send(502,{error:'RailKit could not return this information. The service may be unavailable for these details or your account. Please try again later.',source:'RailKit'});
   }
   return send(200,{source:'RailKit',service:type,retrievedAt:new Date().toISOString(),data:result.data??null});
  }catch{return send(502,{error:'RailKit is unavailable or the request timed out. Please try again later.',source:'RailKit'});}
 };
}
