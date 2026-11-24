import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRailkitHandler,operations} from '../railkit.mjs';
import {istDate,shiftDate,services,validateService} from '../public/services.js';
async function request(handler,params){let status,body;const headers={};const query=typeof params==='string'?params:new URLSearchParams(params);await handler(new URL('http://test/api/railkit?'+query),{setHeader(k,v){headers[k]=v;},writeHead(code){status=code;},end(value){body=JSON.parse(value);}});return {status,body,headers};}
const today=istDate(),d=today.split('-').reverse().join('-'),yesterday=shiftDate(today,-1),yd=yesterday.split('-').reverse().join('-');
const trip={value:'12301',from:'NDLS',to:'HWH',date:today,travelClass:'3A',quota:'GN'};
const cases=[
 ['train',{value:'12301'},'getTrainInfo',['12301']],
 ['station',{value:'ndls',hours:'4'},'liveAtStation',['NDLS',4]],
 ['pnr',{value:'1234567890'},'checkPNRStatus',['1234567890']],
 ['search',{from:'ndls',to:'hwh',date:today},'searchTrainBetweenStations',['NDLS','HWH',d]],
 ['availability',trip,'getAvailability',['12301','NDLS','HWH',d,'3A','GN']],
 ['fare',{...trip,travelClass:'EA',quota:'PT'},'fareLookup',['12301','NDLS','HWH',d,'EA','PT']],
 ['tracking',{value:'12301',date:today},'trackTrain',['12301',d]],
 ['tracking-v2',{value:'12301',date:today},'trackTrainV2',['12301',d]],
 ['history',{value:'12301',date:yesterday},'getTrainHistory',['12301',yd]],
 ['cancellations',{},'cancelList',[]],
 ['station-code',{value:'ndls'},'stationByCode',['NDLS']],
 ['stations-name',{value:'Delhi'},'stationsByName',['Delhi']],
 ['train-number',{value:'12301'},'trainByNumber',['12301']],
 ['trains-name',{value:'Rajdhani'},'trainsByName',['Rajdhani']],
 ['timetable',{value:'ndls',date:today},'trainTimetableAtStation',['NDLS',d]]
];
test('all 15 service contracts map to installed SDK methods with exact argument order',async()=>{
 let configured=0;const calls=[];const sdk={configure(k){assert.equal(k,'secret-test-key');configured++;}};
 for(const [method]of Object.values(operations))sdk[method]=async(...args)=>{calls.push({method,args});return {success:true,data:{items:[]}};};
 const handler=createRailkitHandler({key:'secret-test-key',load:async()=>sdk});
 assert.equal(Object.keys(services).length,15);assert.equal(cases.length,15);
 for(const [type,params,method,args]of cases){const res=await request(handler,{type,...params});assert.equal(res.status,200,type);assert.equal(res.body.service,type);assert.equal(res.body.source,'RailKit');assert.equal(res.headers['Cache-Control'],'no-store');assert.doesNotMatch(JSON.stringify(res),/secret-test-key/);assert.deepEqual(calls.at(-1),{method,args});}
 assert.equal(configured,1);
});
test('optional dates omitted and station window defaults to two hours',async()=>{
 assert.deepEqual(operations.search[1](validateService('search',{from:'NDLS',to:'HWH'})),['NDLS','HWH']);
 assert.deepEqual(operations.timetable[1](validateService('timetable',{value:'NDLS'})),['NDLS']);
 assert.deepEqual(operations.station[1](validateService('station',{value:'NDLS'})),['NDLS',2]);
});
test('missing key fails without simulated fallback',async()=>{const res=await request(createRailkitHandler({key:''}),'type=train&value=12301');assert.equal(res.status,503);assert.equal(res.body.configured,false);assert.equal(res.headers['Cache-Control'],'no-store');});
test('invalid input is rejected before SDK loading',async()=>{const handler=createRailkitHandler({key:'test',load:()=>{throw Error('must not load');}});for(const query of ['type=train&value=x','type=pnr&value=DEMO-one','type=constructor&value=12301','type=station&value=NDLS&hours=7','type=availability&value=12301'])assert.equal((await request(handler,query)).status,400);});
test('provider errors and thrown exceptions are sanitized',async()=>{for(const response of [()=>({success:false,error:'private-key-or-provider-detail'}),()=>{throw Error('private-key-or-provider-detail');}]){const handler=createRailkitHandler({key:'test',load:async()=>({configure(){},getTrainInfo:async()=>response()})});const res=await request(handler,'type=train&value=12301');assert.equal(res.status,502);assert.doesNotMatch(JSON.stringify(res),/private-key/);}});
test('provider no results and limits are actionable errors',async()=>{for(const [error,code]of [['Train history record not found',404],['Rate limit exceeded',429]]){const res=await request(createRailkitHandler({key:'key',load:async()=>({configure(){},getTrainInfo:async()=>({success:false,error})})}),'type=train&value=12301');assert.equal(res.status,code);}});
test('deadline returns a sanitized error and failed SDK imports can be retried',async()=>{
 const slow=createRailkitHandler({key:'key',timeoutMs:5,load:async()=>({configure(){},getTrainInfo:()=>new Promise(()=>{})})});assert.equal((await request(slow,'type=train&value=12301')).status,502);
 let count=0;const retry=createRailkitHandler({key:'key',load:async()=>{if(count++===0)throw Error();return {configure(){},getTrainInfo:async()=>({success:true,data:{}})};}});assert.equal((await request(retry,'type=train&value=12301')).status,502);assert.equal((await request(retry,'type=train&value=12301')).status,200);
});
