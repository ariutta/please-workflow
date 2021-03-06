var exec = require('child_process').exec;
var gulp = require(__dirname + '/../../gulp');
var killStream = require('../util/kill-stream.js');
var path = require('path');
var utils = require('../util/utils.js');

gulp.task('build-docs', function(callback) {
  // I think gulp-jsdoc currently cannot use an external conf.json.
  // Until it's confirmed that it does, we'll disable the gulp-jsdoc command
  // and use exec instead to run the command at the command line.
  /*
  gulp.src(['./lib/*.js', 'README.md'])
    .pipe(jsdoc.parser())
    .pipe(jsdoc.generator('./docs', {
      path: './node_modules/jaguarjs-jsdoc/'
    }, jsdocOptions));
  //*/

  //jsdoc -t "./node_modules/jaguarjs-jsdoc/" -c
  //    "./jsdoc-conf.json" "./lib/" -r "./README.md" -d "./docs/"

  var parentPackageDir = path.join(__dirname, '..', '..', '..');
  var docsDir = path.join(parentPackageDir, 'docs');

  utils.createMkdirpStream(docsDir)
    // TODO why does using @private give an error?
    // We can't use stderr as err until we handle that.
    .through(utils.createExecStream('jsdoc ' +
        '-t "' + path.join('node_modules', 'jaguarjs-jsdoc') + '" ' +
        '-c "' + path.join(parentPackageDir, 'jsdoc-conf.json') + '" ' +
            '"' + path.join(parentPackageDir, 'lib') + '" ' +
        '-r "' + path.join(parentPackageDir, 'README.md') + '" ' +
        '-d "' + docsDir + '"'))
    .errors(function(err, push) {
      throw err;
    })
    .each(function(result) {
      return callback(null, result);
    });

});
