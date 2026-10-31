const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'../../source/extension',f),'utf8');
const {bv,mediaUrl,post,profile}=require('../../source/extension/bilibili.js');
const id='BV1234567890',id2='BV1234567891',url='https://www.bilibili.com/video/'+id+'/';
const cdn=f=>'https://upos.bilivideo.com/upgcxcode/01/02/123/'+f+'.m4s?token=fixture';
const state={videoData:{bvid:id,cid:123,title:'Fixture',desc:'Description',owner:{mid:456,name:'Fixture UP'},pic:'https://i0.hdslb.com/bfs/archive/cover.jpg',pages:[{page:1,cid:123},{page:2,cid:124,part:'Second'}]}};
const v=(height,codecs='avc1.640028')=>({baseUrl:cdn('video'+height),height,bandwidth:height*1000,codecs,mimeType:'video/mp4'});
const play={data:{cid:123,dash:{video:[v(720),v(1080),v(2160,'hev1')],audio:[{baseUrl:cdn('audio'),codecs:'mp4a.40.2',mimeType:'audio/mp4',bandwidth:128000}]}}};
assert.equal(bv(url),id);assert.equal(bv('https://evilbilibili.com/video/'+id),null);
assert.equal(mediaUrl('https://localhost/123/x.m4s','123'),null);
assert.equal(mediaUrl(cdn('video'),'999'),null);
const result=post(url,state,play);assert.equal(result.source.url,cdn('video2160'));assert.equal(post(url,state,play,'1080').source.url,cdn('video1080'));assert.equal(result.source.audio_url,cdn('audio'));assert.equal(result.payload.images.length,1);assert.equal(result.payload.author_handle,'456');
assert.throws(()=>post(url,{videoData:{...state.videoData,bvid:id2}},play),/未确认/);
assert.match(post(url,state,{data:{...play.data,cid:999}}).error,/缺失|受保护/);
assert.match(post(url,state,{data:{dash:{video:[v(1080)],audio:[]}}}).error,/AAC 0/);
assert.match(post(url,state,{data:{durl:[{url:cdn('one')},{url:cdn('two')}]}}).error,/多段/);
assert.match(post(url+'?p=2',state,play).error,/缺失|受保护/);
assert.match(post(url,state,{data:{...play.data,is_preview:1}}).error,/试看/);
function link(target,ad=false,badge=false){return {href:target,closest:s=>s.includes('[data-ad]')?(ad?{}:null):{querySelectorAll:()=>badge?[{textContent:'广告'}]:[]}};}
const doc={querySelector:s=>s.startsWith('#submit')?{querySelectorAll:()=>[link(url),link(url,true),link('https://www.bilibili.com/video/'+id2+'/',false,true),link('https://evil.test/video/'+id)]}:null};
assert.deepEqual(profile('https://space.bilibili.com/456/upload/video',doc).urls,[url]);
assert.throws(()=>profile('https://space.bilibili.com/456',doc),/投稿/);
assert.deepEqual(profile('https://space.bilibili.com/456/lists/9145567?type=season',doc).urls,[url]);
assert.throws(()=>profile('https://www.bilibili.com/',doc),/投稿/);
assert.equal(post(url,{videoData:{...state.videoData,pic:'http://i0.hdslb.com/bfs/archive/cover.jpg'}},{}).payload.images[0].url,'https://i0.hdslb.com/bfs/archive/cover.jpg');
assert.throws(()=>profile('https://space.bilibili.com/456/video',{querySelector:()=>null}),/不会退回/);
async function batch(wrongOwner=false){
 const stored={},saved=[];let current=url;
 const c=vm.createContext({URL,console,structuredClone,batchDirectory:'D:/fixture',batchOptions:{},healthCache:{},
  chrome:{storage:{local:{get:async()=>stored,set:async v=>Object.assign(stored,structuredClone(v))}},scripting:{executeScript:async()=>[{result:{author_url:'https://space.bilibili.com/456/upload/video',author_name:'Fixture UP',handle:'456',view:'videos',urls:[url]}}]},tabs:{create:async o=>{current=o.url;return{id:2}},update:async(_id,o)=>{current=o.url||current;},get:async id=>({status:'complete',url:id===1?'https://space.bilibili.com/456/upload/video':current}),remove:async()=>{}}},
  pageProblem:async()=>null,controlPoint:async()=>{},controlledWait:async()=>{},reportProgress:async()=>{},loadedMedia:async()=>[],
  pagePayload:async()=>({...result.payload,author_handle:wrongOwner?'999':'456',_media:[{...result.source,kind:'video'}]}),
  submit:async()=>{throw Error('Video batch must not save cover');},downloadVideo:async(_t,_p,o)=>{assert.equal(o.source.audio_url,cdn('audio'));saved.push(o);return{new_videos:1,directory:'D:/fixture/批量/B站/UP'};}});
 vm.runInContext(read('batch.js'),c);
 await vm.runInContext("runSocialBatch({id:1,url:'https://space.bilibili.com/456/upload/video'},8766,{video_only:true,include_videos:true,limit:1,collection_mode:'images'},'bilibili')",c);
 assert.equal(saved.length,wrongOwner?0:1);
 if(!wrongOwner)assert.equal(stored.collectorCheckpoint.records[url].video_count,1);
}
(async()=>{await batch();await batch(true);console.log('PASS: Bilibili identity/owner/CID/quality/audio, ads and recommendations excluded, batch quota/source preserved. Synthetic fixtures only.');})().catch(e=>{console.error(e);process.exitCode=1;});
