'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const files = ['affiliate/chaturbate-revshare.js','providers/chaturbate.js','providers/bongacams.js','providers/feed-cache.js','providers/revenue-ledger.js','scripts/verify-v2.js'];
for (const file of files) {
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
}
console.log('JavaScript syntax checks passed for standalone modules');