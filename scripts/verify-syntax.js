'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const files = ['server-v2.js','boot-v2.js','affiliate/chaturbate-revshare.js','providers/chaturbate.js','providers/bongacams.js','providers/feed-cache.js','providers/revenue-ledger.js','scripts/verify-v2.js'];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  new vm.Script(source, { filename: file });
}
console.log('JavaScript syntax checks passed');