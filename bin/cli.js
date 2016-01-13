#!/usr/bin/env node

var fs = require('fs');
var RxNode = require('rx-node-extra');
var semverBumperForFileText = require('../index.js');

var program = require('commander');
var npmPackage = JSON.parse(fs.readFileSync(
      __dirname + '/../package.json', {encoding: 'utf8'}));
program
  .version(npmPackage.version);

/* TODO create this
program
  .command('set')
  .description('Specify and save your desired settings.')
  .action(function(newVersion, options) {
    var stream = semverBumperForFileText.set();
    var disposable = RxNode.writeToStream(stream, process.stdout, 'utf8');
  });
//*/

program
  .command('bump [newVersion]')
  .description('Bump semver version of all relevant files for this package.')
  .action(function(newVersion, options) {
    var bumpStream = semverBumperForFileText.bump({
      newVersion: newVersion
    });
    var disposable = RxNode.writeToStream(bumpStream, process.stdout, 'utf8');
  })
  .on('--help', function() {
    console.log('  Examples:');
    console.log();
    console.log('    $ ./bin/cli.js bump');
    console.log('    $ ./bin/cli.js bump 1.2.3');
    console.log();
  });

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}
