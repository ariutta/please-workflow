var gulp = require(__dirname + '/../../gulp');
var buildBranch = require('gulp-build-branch');
var mkdirp = require('mkdirp');
var path = require('path');

gulp.task('github-pages', function githubPages() {
  mkdirp.sync(path.join(__dirname, '..', '..', 'demo'));
  return buildBranch({folder: 'demo'});
});
