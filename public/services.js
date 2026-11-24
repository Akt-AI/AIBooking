// Shared request contract. No provider credentials or SDK code are sent to browsers.
export function istDate(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=t=>parts.find(p=>p.type===t).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftDate(date,days){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
const code=(label)=>({label,kind:'code',placeholder:'NDLS',hint:'Station code, for example NDLS, HWH or MAS.'});
const train={label:'Train number',kind:'train',placeholder:'12301',hint:'Enter the five-digit train number.'};
const date=(label,range,optional=false)=>({label,kind:'date',range,optional});
const route={from:code('From station'),to:code('To station')};
const classes={'1A':'First AC','2A':'AC 2 Tier','3A':'AC 3 Tier','3E':'AC 3 Economy',SL:'Sleeper','2S':'Second Sitting',CC:'AC Chair Car',EC:'Executive Chair Car'};
const quota={GN:'General',LD:'Ladies',SS:'Senior Citizen',TQ:'Tatkal'};
const travel={...route,date:date('Journey date','future'),travelClass:{label:'Travel class',kind:'select',options:classes,default:'3A'},quota:{label:'Quota',kind:'select',options:quota,default:'GN'}};
export const services={
 search:{title:'Find trains',short:'Trains between stations',description:'Find direct trains for your route. Choose a date to narrow your search.',icon:'⌕',category:'Plan',fields:{...route,date:date('Journey date','future',true)}},
 availability:{title:'Seat availability',short:'Seats and availability',description:'Check availability by train, date, class and quota. Availability can change before booking.',icon:'▦',category:'Plan',fields:{value:train,...travel}},
 fare:{title:'Fare breakdown',short:'Know your fare',description:'View the provider’s fare breakdown for a specific journey. Final fares are confirmed by the booking provider.',icon:'₹',category:'Plan',fields:{value:train,...travel,travelClass:{...travel.travelClass,options:{...classes,EA:'Anubhuti',FC:'First Class',VS:'Vistadome Non-AC',CH:'Chair Car',HS:'AC Sleeper',VC:'Vistadome AC',VA:'Vistadome AC Chair Car'}},quota:{...travel.quota,options:{...quota,DF:'Defence',FT:'Foreign Tourist',LB:'Lower Berth',PT:'Premium Tatkal',YU:'Yuva',DP:'Duty Pass',HP:'Handicap',PH:'Parliament House'}}}},
 pnr:{title:'PNR status',short:'Check your reservation',description:'Check an existing reservation. Your PNR is sent to RailKit; we do not save the query or passenger results.',icon:'▤',category:'Travel',fields:{value:{label:'PNR number',kind:'pnr',placeholder:'10-digit PNR',hint:'Use the PNR from your actual ticket.'}}},
 tracking:{title:'Live train status',short:'Track your train',description:'Follow running status, delays and the station timeline. Use the date your train started its journey.',icon:'◉',category:'Travel',fields:{value:train,date:date('Train start date','recent')}},
 'tracking-v2':{title:'Alternative train tracker',short:'Alternative running status',description:'Check the alternative tracking feed when you need another running-status source.',icon:'◎',category:'Travel',fields:{value:train,date:date('Train start date','recent')}},
 station:{title:'Live station board',short:'Departures and arrivals',description:'See upcoming trains at a station over the next two, four or eight hours.',icon:'◷',category:'Travel',fields:{value:code('Station code'),hours:{label:'Time window',kind:'select',options:{2:'Next 2 hours',4:'Next 4 hours',8:'Next 8 hours'},default:'2'}}},
 train:{title:'Train details & route',short:'Every stop along the way',description:'View the train’s route, scheduled times, running days and station information.',icon:'≋',category:'Plan',fields:{value:train}},
 timetable:{title:'Station timetable',short:'Scheduled trains',description:'See the station’s scheduled trains. Leave the date blank for all running days, or choose yesterday, today or tomorrow.',icon:'▥',category:'Plan',fields:{value:code('Station code'),date:date('Timetable date','near',true)}},
 history:{title:'Journey history',short:'Past runs and delays',description:'Look up a completed run. A record is available only after the provider has stored the completed journey.',icon:'◴',category:'Travel',fields:{value:train,date:date('Journey start date','past')}},
 cancellations:{title:'Cancelled trains',short:'Service disruptions',description:'Check the provider’s list of fully and partially cancelled trains. This service does not cancel your ticket.',icon:'⊘',category:'Travel',fields:{}},
 'stations-name':{title:'Find a station',short:'Search stations by name',description:'Find station codes by typing at least two characters of a station name.',icon:'⌂',category:'Discover',fields:{value:{label:'Station name',kind:'name',placeholder:'Delhi'}}},
 'station-code':{title:'Station details',short:'Look up a station code',description:'Resolve a station code to its name and coordinates.',icon:'◇',category:'Discover',fields:{value:code('Station code')}},
 'trains-name':{title:'Find a train by name',short:'Search the train directory',description:'Find train numbers by typing at least two characters of the train name.',icon:'⌕',category:'Discover',fields:{value:{label:'Train name',kind:'name',placeholder:'Rajdhani'}}},
 'train-number':{title:'Train name lookup',short:'Resolve a train number',description:'Look up the name associated with an exact train number.',icon:'#',category:'Discover',fields:{value:train}}
};
export function dateBounds(range,today=istDate()){
 return {future:{min:today},recent:{min:shiftDate(today,-5),max:today},near:{min:shiftDate(today,-1),max:shiftDate(today,1)},past:{max:today}}[range]||{};
}
export function validateService(type,params,today=istDate()){
 const service=Object.hasOwn(services,type)?services[type]:null;
 if(!service)throw Error('Choose a supported rail service.');
 const out={};
 for(const [key,field]of Object.entries(service.fields)){
  let value=String(params[key]??field.default??'').trim();
  if(!value&&field.optional)continue;
  if(['code','train','pnr'].includes(field.kind))value=value.toUpperCase();
  if(field.kind==='code'&&!/^[A-Z0-9]{1,5}$/.test(value))throw Error(`${field.label}: enter a station code of 1–5 letters or digits.`);
  if(field.kind==='train'&&!/^\d{5}$/.test(value))throw Error('Enter a five-digit train number.');
  if(field.kind==='pnr'&&!/^\d{10}$/.test(value))throw Error('Enter a ten-digit PNR number.');
  if(field.kind==='name'&&(value.length<2||value.length>80||/[\x00-\x1f]/.test(value)))throw Error(`${field.label}: enter between 2 and 80 characters.`);
  if(field.kind==='select'&&!Object.hasOwn(field.options,value))throw Error(`Choose a valid ${field.label.toLowerCase()}.`);
  if(field.kind==='date'){
   const parsed=new Date(value+'T12:00:00Z'),bounds=dateBounds(field.range,today);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)throw Error(`Choose a valid ${field.label.toLowerCase()}.`);
   if((bounds.min&&value<bounds.min)||(bounds.max&&value>bounds.max))throw Error(`${field.label} must be ${bounds.min?'on or after '+bounds.min:''}${bounds.min&&bounds.max?' and ':''}${bounds.max?'on or before '+bounds.max:''}.`);
  }
  out[key]=value;
 }
 if(out.from&&out.from===out.to)throw Error('Choose different origin and destination stations.');
 return out;
}
