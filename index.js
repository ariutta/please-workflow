var fs = require('fs');
var onlyScripts = require('./util/script-filter');
var tasks = fs.readdirSync(__dirname + '/tasks/').filter(onlyScripts);

tasks.forEach(function(task) {
  console.log('task in wb-sub');
  console.log(task);
  require(__dirname + '/tasks/' + task);
});
