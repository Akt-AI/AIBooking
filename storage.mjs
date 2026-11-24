import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function createStore(filename=':memory:'){
 if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS ai_daily(day TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,successes INTEGER NOT NULL DEFAULT 0,tokens INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS clicks(day TEXT,provider TEXT,source TEXT,count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,provider,source));
 CREATE TABLE IF NOT EXISTS placements(provider TEXT PRIMARY KEY,url TEXT NOT NULL,affiliate INTEGER NOT NULL DEFAULT 0,sponsored INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,created TEXT NOT NULL,company TEXT NOT NULL,email TEXT NOT NULL,interest TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',consent INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS payment_requests(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,amount INTEGER NOT NULL,description TEXT NOT NULL,mode TEXT NOT NULL,provider_id TEXT UNIQUE,checkout_url TEXT,status TEXT NOT NULL DEFAULT 'creating',created TEXT NOT NULL,updated TEXT NOT NULL,expires INTEGER NOT NULL);
 `);
 return {
  addPayment({id,requestKey,amount,description,mode,expires}){const now=new Date().toISOString();db.prepare('INSERT INTO payment_requests(id,request_key,amount,description,mode,created,updated,expires) VALUES(?,?,?,?,?,?,?,?)').run(id,requestKey,amount,description,mode,now,now,expires);},
  payment(id){return db.prepare('SELECT * FROM payment_requests WHERE id=?').get(id);},
  paymentByKey(key){return db.prepare('SELECT * FROM payment_requests WHERE request_key=?').get(key);},
  payments(){return db.prepare('SELECT * FROM payment_requests ORDER BY created DESC LIMIT 100').all();},
  attachPayment(id,providerId,url){db.prepare("UPDATE payment_requests SET provider_id=?,checkout_url=?,status='created',updated=? WHERE id=? AND status='creating'").run(providerId,url,new Date().toISOString(),id);},
  paymentStatus(id,status){db.prepare("UPDATE payment_requests SET status=?,updated=? WHERE id=? AND status != 'paid' AND status != ? AND (status NOT IN ('cancelled','expired') OR ?='paid')").run(status,new Date().toISOString(),id,status,status);},
  reserveAI(day,cap){db.prepare('INSERT INTO ai_daily(day) VALUES(?) ON CONFLICT DO NOTHING').run(day);return db.prepare('UPDATE ai_daily SET attempts=attempts+1 WHERE day=? AND attempts<?').run(day,cap).changes===1;},
  finishAI(day,tokens){db.prepare('UPDATE ai_daily SET successes=successes+1,tokens=tokens+? WHERE day=?').run(Math.max(0,Math.min(100000,Math.floor(Number(tokens)||0))),day);},
  click(day,provider,source){db.prepare('INSERT INTO clicks(day,provider,source,count) VALUES(?,?,?,1) ON CONFLICT(day,provider,source) DO UPDATE SET count=count+1').run(day,provider,source);},
  placements(){return db.prepare('SELECT * FROM placements').all();},
  place({provider,url,affiliate,sponsored}){db.prepare('INSERT INTO placements(provider,url,affiliate,sponsored) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET url=excluded.url,affiliate=excluded.affiliate,sponsored=excluded.sponsored').run(provider,url,Number(affiliate),Number(sponsored));},
  addLead({company,email,interest,message}){if(db.prepare('SELECT count(*) AS n FROM leads').get().n>=5000)throw Error('capacity');const id=randomUUID();db.prepare('INSERT INTO leads(id,created,company,email,interest,message,consent) VALUES(?,?,?,?,?,?,1)').run(id,new Date().toISOString(),company,email,interest,message);return id;},
  updateLead(id,status){return db.prepare('UPDATE leads SET status=? WHERE id=?').run(status,id).changes===1;},
  report(){return {ai:db.prepare('SELECT * FROM ai_daily ORDER BY day DESC LIMIT 30').all(),clicks:db.prepare('SELECT day,provider,source,count FROM clicks ORDER BY day DESC,count DESC LIMIT 500').all(),leads:db.prepare('SELECT id,created,company,email,interest,message,status FROM leads ORDER BY created DESC LIMIT 300').all(),placements:db.prepare('SELECT * FROM placements').all()};},
  close(){db.close();}
 };
}
