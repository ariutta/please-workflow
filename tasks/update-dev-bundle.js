var gulp = require(__dirname + '/../../gulp');
var highland = require('highland');
var mkdirp = require('mkdirp');
var packageJson = require('../../../package.json');
var path = require('path');

gulp.task('update-dev-bundle', function(done) {

  mkdirp.sync(path.join(__dirname, '..', '..', 'dist'));

  return gulp.src('./dist/**')
		.pipe(gulp.dest('./test/lib/' + packageJson.name));
});
