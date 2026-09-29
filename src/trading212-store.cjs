const fs=require('node:fs'),path=require('node:path');
const {randomBytes,createCipheriv,createDecipheriv,createHash}=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
function accountKey(environment,summary){if(!summary.id||!summary.currency)throw new Error('Trading 212 did not provide an account identity. Tracking is unavailable.');return createHash('sha256').update(`${environment}\0${summary.id}\0${summary.currency}`).digest('hex');}
class TradingStore {
 constructor(directory,safeStorage){
  if(!safeStorage.isEncryptionAvailable())throw new Error('macOS encryption is unavailable. Investment history stays locked.');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});this.directory=directory;const keyFile=path.join(directory,'key'),dbFile=path.join(directory,'history.sqlite');
  if(fs.existsSync(keyFile))this.key=Buffer.from(safeStorage.decryptString(fs.readFileSync(keyFile)),'base64');
  else {if(fs.existsSync(dbFile))throw new Error('Investment history encryption key is missing. Restore it before opening this store.');this.key=randomBytes(32);fs.writeFileSync(keyFile,safeStorage.encryptString(this.key.toString('base64')),{mode:0o600,flag:'wx'});}
  if(this.key.length!==32)throw new Error('Invalid investment history encryption key.');
  this.db=new DatabaseSync(dbFile);fs.chmodSync(dbFile,0o600);
  this.db.exec('PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON; PRAGMA busy_timeout=3000;');
  const version=this.db.prepare('PRAGMA user_version').get().user_version;if(version>1){this.db.close();throw new Error('Investment history was written by a newer Orb version.');}
  this.db.exec('BEGIN; CREATE TABLE IF NOT EXISTS records(account TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, at TEXT NOT NULL, payload BLOB NOT NULL, PRIMARY KEY(account,kind,id)); CREATE INDEX IF NOT EXISTS record_dates ON records(account,kind,at); PRAGMA user_version=1; COMMIT;');
 }
 seal(account,kind,id,value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(Buffer.from(`${account}\0${kind}\0${id}`));return Buffer.concat([iv,cipher.update(JSON.stringify(value),'utf8'),cipher.final(),cipher.getAuthTag()]);}
 open(account,kind,id,blob){try{const b=Buffer.from(blob),cipher=createDecipheriv('aes-256-gcm',this.key,b.subarray(0,12));cipher.setAAD(Buffer.from(`${account}\0${kind}\0${id}`));cipher.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([cipher.update(b.subarray(12,-16)),cipher.final()]).toString('utf8'));}catch{throw new Error('Investment history could not be decrypted. The stored record may be damaged.');}}
 put(account,kind,id,value,at=new Date().toISOString()){this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?) ON CONFLICT(account,kind,id) DO UPDATE SET at=excluded.at,payload=excluded.payload').run(account,kind,id,at,this.seal(account,kind,id,value));}
 get(account,kind,id){const row=this.db.prepare('SELECT payload FROM records WHERE account=? AND kind=? AND id=?').get(account,kind,id);return row?this.open(account,kind,id,row.payload):null;}
 list(account,kind){return this.db.prepare('SELECT id,payload FROM records WHERE account=? AND kind=? ORDER BY at,id').all(account,kind).map(r=>this.open(account,kind,r.id,r.payload));}
 recent(account,kind,limit=100){return this.db.prepare('SELECT id,payload FROM records WHERE account=? AND kind=? ORDER BY at DESC,id DESC LIMIT ?').all(account,kind,limit).map(r=>this.open(account,kind,r.id,r.payload));}
 batch(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 remove(account){this.db.prepare('DELETE FROM records WHERE account=?').run(account);}
 stats(account){return {records:this.db.prepare('SELECT count(*) AS n FROM records WHERE account=?').get(account).n,bytes:fs.statSync(path.join(this.directory,'history.sqlite')).size};}
 accounts(){return this.db.prepare("SELECT account,payload FROM records WHERE kind='meta' AND id='account'").all().map(r=>{const m=this.open(r.account,'meta','account',r.payload);return {accountKey:r.account,environment:m.environment,currency:m.currency,createdAt:m.createdAt,lastCapture:m.lastCapture};});}
 export(account){return {schemaVersion:1,exportedAt:new Date().toISOString(),account,records:this.db.prepare('SELECT kind,id,payload FROM records WHERE account=? ORDER BY kind,at').all(account).map(r=>({kind:r.kind,id:r.id,value:this.open(account,r.kind,r.id,r.payload)}))};}
 pruneHoldings(account,before){this.db.prepare("DELETE FROM records WHERE account=? AND kind='holding-observation' AND at<?").run(account,before);}
 close(){this.db.close();this.key.fill(0);}
}
module.exports={TradingStore,accountKey};
