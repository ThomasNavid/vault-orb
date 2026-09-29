// Preserve the broker's numeric lexemes before projecting display numbers.
class SourceNumber extends Number { constructor(source){super(source);this.source=source;} toString(){return this.source;} }
function parseJSON(source){return JSON.parse(source,(_key,value,context)=>typeof value==='number'?new SourceNumber(context.source):value);}
const numeric=value=>(typeof value==='number'||value instanceof SourceNumber)&&Number.isFinite(Number(value))?Number(value):null;
const exact=value=>numeric(value)===null?null:String(value);
function amounts(value,keys){return {...Object.fromEntries(keys.map(k=>[k,numeric(value?.[k])])),exact:Object.fromEntries(keys.map(k=>[k,exact(value?.[k])]))};}
function gcd(a,b){a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a||1n;}
class Decimal {
 constructor(n,d=1n){if(!d)throw new Error('Cannot divide by zero.');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);this.n=n/g;this.d=d/g;}
 static from(value){if(value instanceof Decimal)return value;const s=String(value),m=/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(s);if(!m||s.length>150)throw new Error('Missing or invalid amount.');const exponent=Number(m[4]||0)-(m[3]?.length||0);if(Math.abs(exponent)>100)throw new Error('Amount out of range.');const n=BigInt(m[2]+(m[3]||''))*(m[1]?-1n:1n);return exponent>=0?new Decimal(n*10n**BigInt(exponent)):new Decimal(n,10n**BigInt(-exponent));}
 add(v){v=Decimal.from(v);return new Decimal(this.n*v.d+v.n*this.d,this.d*v.d);}
 sub(v){v=Decimal.from(v);return new Decimal(this.n*v.d-v.n*this.d,this.d*v.d);}
 mul(v){v=Decimal.from(v);return new Decimal(this.n*v.n,this.d*v.d);}
 div(v){v=Decimal.from(v);return new Decimal(this.n*v.d,this.d*v.n);}
 abs(){return new Decimal(this.n<0n?-this.n:this.n,this.d);}
 get positive(){return this.n>0n;}
 number(){const result=Number(this.n)/Number(this.d);if(!Number.isFinite(result))throw new Error('Amount out of range.');return result;}
}
const decimal=(object,key)=>Decimal.from(object?.exact?.[key]??object?.[key]);
module.exports={SourceNumber,parseJSON,numeric,exact,amounts,Decimal,decimal};
