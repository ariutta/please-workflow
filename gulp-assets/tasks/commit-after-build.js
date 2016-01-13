var config = require('../workflow-bob.json');
var fs = require('fs');
var git = require('gulp-git');
var gitStreaming = require('../util/git-streaming.js');
var gulp = require(__dirname + '/../../gulp');
var highland = require('highland');

var parentPackageDir = __dirname + '/../../../';

var metadataFilePaths = config.metadataFilePaths;

gulp.task('commit-after-build', function commitAfterBuild(callback) {
  var package = JSON.parse(fs.readFileSync(parentPackageDir + 'package.json'));
  var version = package.version;

  gulp.src([
            './test/jquery-demos/*.html',
            './test/web-component-demos/*.html',
            './demo/*.html',
            './README.md']
            .concat(metadataFilePaths)
            .map(function(path) {
              return parentPackageDir + path;
            })
  )
  .pipe(highland.pipeline())
  .errors(function(err, push) {
    throw err;
  })
  .through(git.add())
  .through(git.commit('Built and bumped version to ' + version + '.'))
  .errors(function(err, push) {
    throw err;
  })
  .last()
  .each(function() {
    return callback();
  });
});
