var fs = require('fs');
var killStream = require('./util/kill-stream.js');
var onlyScripts = require('./util/script-filter');
var tasks = fs.readdirSync(__dirname + '/tasks/').filter(onlyScripts);

tasks.forEach(function(task) {
  require(__dirname + '/tasks/' + task);
});
