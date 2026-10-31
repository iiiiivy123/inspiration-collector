const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../source/extension/hub-api.js'), 'utf8');
(async () => {
  for (const [failure, expected] of [[new TypeError('Failed to fetch'), /Windows 开始菜单/],
    [Object.assign(new Error('timeout'), {name: 'TimeoutError'}), /避免重复/]]) {
    const context = vm.createContext({fetch: async () => {throw failure;}, AbortSignal});
    vm.runInContext(source + ';globalThis.testHub = Hub;', context);
    await assert.rejects(context.testHub.api('/health'), expected);
  }
  console.log('Offline connection and timeout guidance passed');
})().catch(error => {console.error(error); process.exitCode = 1;});
