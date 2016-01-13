var fs = require('fs');
var gulp = require(__dirname + '/../../gulp');
var mkdirp = require('mkdirp');
var path = require('path');
var replace = require('gulp-regex-replace');

gulp.task('create-demos-from-tests', function(done) {

  mkdirp.sync(path.join(__dirname, '..', '..', 'demo'));
  mkdirp.sync(path.join(__dirname, '..', '..', 'test', 'browser-tests'));

  // Reading it here (instead of using require) because the
  // version may have been bumped since require was called.
  var packageJson = JSON.parse(fs.readFileSync(
      'package.json', 'utf8'));

  return gulp.src([path.join('test', 'index.html'),
                            path.join('test', 'browser-tests', '**')],
                   {base: 'test'})
    .pipe(replace({
      // TODO Could make this better to avoid unintended changes.
      // Maybe something like this (but need to test that it works
      // with the gulp-regex-replace plugin - it might require an
      // extra backslash to make the backslashes work):
      /*
      regex: '/(' + packageJson.name + '[\.-\/].*)(\.min\.js)|(\.js)/', // jshint ignore:line
      replace: '$1.min.js'
      //*/
      regex: '\.js', // jshint ignore:line
      replace: '.min.js'
    }))
    .pipe(replace({
      // NOTE keep the forward slashes, because this is for
      // URLs, not local filepaths.
      regex: packageJson.name + '\/dev\/',
      replace: packageJson.name + '/' + packageJson.version + '/'
    }))
		.pipe(gulp.dest('demo'));
});
