/* browserify task
   ---------------
   Bundle javascripty things with browserify!

   If the watch task is running, this uses watchify instead
   of browserify for faster bundling using caching.
*/

var brfs = require('gulp-brfs');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var bundleLogger = require('../util/bundle-logger.js');
var fs = require('fs');
var gulp = require(__dirname + '/../../gulp');
var handleErrors = require('../util/handle-errors.js');
var highland = require('highland');
var path = require('path');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream');
var sourcemaps = require('gulp-sourcemaps');
var uglify = require('gulp-uglify');
var watchify = require('watchify');

gulp.task('browserify', ['lint', 'browserify-polyfills'], function() {

  var packageJson = JSON.parse(fs.readFileSync(path.join(
        __dirname, '..', '..', '..', 'package.json')));

  var getBundleName = function() {
    var version = packageJson.version;
    var name = packageJson.name;
    return name + '.bundle';
  };

  var bundler = browserify({
    // Required watchify args
    cache: {}, packageCache: {}, fullPaths: true,
    // Browserify Options
    // specify entry point of app
    entries: ['./index.js'],
    // Enable source maps!
    debug: true,
    //insertGlobals : true,
    //exclude: 'cheerio'
	});
  /*
  // enable fs.readFileSync() in browser
  .transform('brfs')
  .transform('deglobalify');
  //*/

  var bundle = function() {
		// Log when bundling starts
    bundleLogger.start();

    return bundler
			.bundle()
			// Report compile errors
			.on('error', handleErrors)
			// Use vinyl-source-stream to make the
			// stream gulp compatible. Specify the
			// desired output filename here.
      .pipe(source(getBundleName() + '.js'))
      .pipe(highland.pipeline(function(stream) {
        if (global.isWatching) {
          return stream;
        }

        return stream
          // These steps are only enabled when
          // a watch is not set.
          // They are too slow to enable
          // during development.
          .through(buffer())
          .through(rename(function(path) {
            path.extname = '.min.js';
          }))
          .through(sourcemaps.init({loadMaps: true}))
          // Add transformation tasks to the pipeline here.
          .through(uglify())
          .through(sourcemaps.write('./'))
          .through(gulp.dest('./dist/' + packageJson.version + '/'))
          .through(gulp.dest('./demo/lib/' + packageJson.name + '/' + packageJson.version + '/'));
      }))
      // Specify the output destination
      .pipe(gulp.dest('./test/lib/' + packageJson.name + '/dev/'))
			// Log when bundling completes!
			.on('end', bundleLogger.end);
  };

  if (global.isWatching) {
		// Rebundle with watchify on changes.
    bundler = watchify(bundler);
    bundler.on('update', bundle);
  }

  return bundle();
});
