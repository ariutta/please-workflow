var fs = require('fs');
var gulp = require(__dirname + '/../../gulp');
var highland = require('highland');
var replace = require('gulp-regex-replace');

gulp.task('create-demos-from-tests', function(done) {
  // Reading it here (instead of using require) because
  // the version may have been bumped since require ran.
  var packageJson = JSON.parse(fs.readFileSync(
      'package.json', 'utf8'));

  return highland(gulp.src(['./test/index.html',
                            './test/lib/**',
                            './test/browser-tests/**'],
                   {base: './test'})
    .pipe(replace({
      regex: packageJson.name + '-polyfills-dev.bundle',
      replace: packageJson.name + '-polyfills-' + packageJson.version + '.bundle.min'
    }))
    .pipe(replace({
      regex: packageJson.name + '-dev.bundle',
      replace: packageJson.name + '-' + packageJson.version + '.bundle.min'
    })))
    // these are not included, because they don't have the string we're replacing.
    .concat(gulp.src(['./test/index.html',
                   './test/lib/**/*'],
                   {base: './test'}))
		.pipe(gulp.dest('./demo'));
});
