var jshint = require('gulp-jshint');
var gulp = require(__dirname + '/../../gulp');
var mkdirp = require('mkdirp');
var path = require('path');

gulp.task('lint', function() {
  mkdirp.sync(path.join(__dirname, '..', '..', 'lib'));
  return gulp.src('./lib/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
    .pipe(jshint.reporter('fail'));
});
