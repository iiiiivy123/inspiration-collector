const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dir = path.join(__dirname, '../../source/extension');
const {platform, imageUrl} = require('../../source/extension/platforms.js');
for (const [host, name] of [['www.xiaohongshu.com','xhs'],['www.instagram.com','instagram'],['x.com','x'],['www.pinterest.com','pinterest'],['huaban.com','huaban'],['weibo.com','weibo'],['evilxiaohongshu.com','generic']]) assert.equal(platform(host), name);
assert.equal(imageUrl({srcset:'https://example.com/large 1000w, https://example.com/small 100w'}, 'generic'), 'https://example.com/large');
assert.equal(imageUrl({src:'javascript:alert(1)'}, 'generic'), '');
assert.match(imageUrl({src:'https://pbs.twimg.com/media/abc?format=png&name=small'}, 'x'), /name=orig/);
const context = vm.createContext({URL, window:{}, location:{hostname:'www.instagram.com', pathname:'/p/ABC123/'},
  document:{querySelectorAll:()=>[{textContent:JSON.stringify({items:[
    {code:'ABC123',carousel_media:[{image_versions2:{candidates:[{url:'https://s.cdninstagram.com/a.jpg',width:100,height:100},{url:'https://s.cdninstagram.com/large.jpg',width:1000,height:1000}]}},{display_url:'https://s.cdninstagram.com/b.jpg'}]},
    {code:'OTHER123',display_url:'https://s.cdninstagram.com/not-this-post.jpg'}]})}]}});
for (const f of ['cat-instagram.js','cat-xhs.js','cat-media.js']) vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),context);
const result=vm.runInContext(fs.readFileSync(path.join(dir,'page-media.js'),'utf8'),context);
assert.equal(result.media.length,2);
assert.match(result.media[0].url,/large.jpg$/);
assert.ok(!result.media.some(item=>item.url.includes('not-this-post')));
console.log('PASS: platform boundaries, srcset choice, exact post identity and carousel parsing (offline).');
