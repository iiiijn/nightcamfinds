'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('public/app.js', 'utf8');

test('Featured homepage uses the worldwide provider category renderer', () => {
  assert.match(
    app,
    /const isUnfilteredRegionalView = \["all","live","female","male","trans","couples","hd","new","popular"\]\.includes\(category\)/
  );
  assert.match(app, /if \(isUnfilteredRegionalView\) \{\s*renderRegionalSections\(data\.regionalRooms \|\| \{\}\);/);
});

test('Featured homepage renderer keeps Chaturbate and BongaCams sections independent', () => {
  assert.match(app, /\["Chaturbate", "chaturbate", window\.__ncfTopChaturbateByCategory \|\| \{\}\]/);
  assert.match(app, /\["BongaCams", "bongacams", window\.__ncfTopBongaByCategory \|\| \{\}\]/);
  for (const category of ['female', 'male', 'trans', 'couples']) {
    assert.ok(app.includes('["' + category + '",'));
  }
  assert.match(app, /count\.textContent = rooms\.length \+ " live rooms worldwide"/);
});
