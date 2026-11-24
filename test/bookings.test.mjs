import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingCategories,bookingProviders,bookingGroups,providerLink} from '../public/bookings.js';
test('booking destinations use explicit HTTPS provider hosts without credentials or affiliate IDs',()=>{
 const hosts=new Set(['www.skyscanner.co.in','www.airindia.com','www.goindigo.in','www.booking.com','www.agoda.com','www.redbus.in','www.abhibus.com','m.uber.com','www.getyourguide.com','in.bookmyshow.com','www.district.in','paytm.com','www.phonepe.com','www.jio.com','www.airtel.in','www.delhivery.com','www.dtdc.com','mydhl.express.dhl']);
 for(const provider of bookingProviders){const url=new URL(providerLink(provider.id));assert.equal(url.protocol,'https:');assert.ok(hosts.has(url.hostname));assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.search,'');assert.ok(Object.hasOwn(bookingCategories,provider.category));}
 assert.equal(new Set(bookingProviders.map(p=>p.id)).size,bookingProviders.length);
 for(const category of Object.keys(bookingCategories))assert.ok(bookingProviders.some(p=>p.category===category));
});
test('arbitrary destinations cannot be supplied through provider IDs',()=>{for(const id of ['https://example.com','javascript:alert(1)','constructor','__proto__','unknown'])assert.throws(()=>providerLink(id));});

test('daily service groups and direct fragment categories cover the requested services',()=>{
 for(const category of ['movies','concerts','recharge','bills','domestic-shipping','international-shipping']){assert.ok(Object.hasOwn(bookingCategories,category));assert.ok(bookingProviders.some(p=>p.category===category));}
 for(const [name,group]of Object.entries(bookingGroups))assert.equal(bookingCategories[group.first].group,name);
 for(const category of Object.values(bookingCategories))assert.ok(Object.hasOwn(bookingGroups,category.group));
});
test('PhonePe handoffs explicitly identify app requirements and shipping categories stay distinct',()=>{
 for(const provider of bookingProviders.filter(p=>p.name==='PhonePe')){assert.equal(provider.mode,'app');assert.match(provider.description,/app/);assert.equal(new URL(providerLink(provider.id)).hostname,'www.phonepe.com');}
 assert.ok(bookingProviders.some(p=>p.category==='domestic-shipping'&&p.name==='Delhivery'));
 assert.ok(bookingProviders.some(p=>p.category==='international-shipping'&&p.name==='DHL Express'));
 assert.ok(bookingCategories['international-shipping'].notes.some(n=>/customs/.test(n)));
});
