// please-workflow/lib/index.js

'use strict';
var init = require('./init.js');

function speak() {
  console.log('hi');
}

module.exports = {
  init: init,
  speak: speak
};
