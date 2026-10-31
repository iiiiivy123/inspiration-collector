// Synthetic byte streams only; no website or credentials.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../../source/extension/background.js'),'utf8');
const fn=source.slice(source.indexOf('async function includeProtectedImages('),source.indexOf('\nasync function ',source.indexOf('async function includeProtectedImages(')+10));
async function run(sizes){
 let active=0,peak=0,cancelled=0;
 const context=vm.createContext({Blob,Uint8Array,btoa,fetch:async url=>{
  active++;peak=Math.max(peak,active);let used=false;
  return {ok:true,headers:{get:()=> 'image/png'},body:{getReader:()=>({
   read:async()=>{await new Promise(r=>setTimeout(r,1));if(used)return {done:true};used=true;return {done:false,value:new Uint8Array(sizes[Number(url)]).fill(Number(url)+1)};},
   cancel:async()=>{active--;cancelled++;},releaseLock(){}})}};
 }});
 vm.runInContext(fn,context);
 const payload={images:sizes.map((_,i)=>({url:String(i)}))};
 try{await context.includeProtectedImages(payload,'https://www.xiaohongshu.com/explore/fixture');return {payload,peak,cancelled};}
 finally{assert.ok(peak<=2,'At most two complete-image conversions');}
}
(async()=>{
 const result=await run([3,4,5,6,7]);assert.equal(result.cancelled,5);
 result.payload.images.forEach((item,i)=>{assert.equal(item.url,String(i));assert.equal(Buffer.from(item.data_base64,'base64')[0],i+1);});
 await assert.rejects(run([31*1048576]),/单张30MB/);
 await assert.rejects(run([23*1048576,23*1048576,23*1048576]),/单次64MB/);
 console.log('PASS: bounded browser image concurrency, stable order, per-image and aggregate byte limits.');
})().catch(error=>{console.error(error);process.exitCode=1;});
