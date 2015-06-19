// see setup guide for using with gulp: http://www.browsersync.io/docs/gulp/
var browserSync = require('browser-sync');
var evt = browserSync.emitter;
var gulp = require(__dirname + '/../../gulp');
var mkdirp = require('mkdirp');
var packageJson = require('../../../package.json');
var path = require('path');
var reload = browserSync.reload;

evt.on('rs', function() {
  console.log('You want to reload BrowserSync!');
});

gulp.task('browser-sync', ['browserify', 'browserify-polyfills'], function() {

  mkdirp.sync(path.join(__dirname, '..', '..', 'lib'));
  var devCompileTargetDir = path.join('test', 'lib', packageJson.name, 'dev');
  var devCompileTargetDirRel = path.join(__dirname, '..', '..', devCompileTargetDir);
  mkdirp.sync(devCompileTargetDirRel);

  browserSync(['./index.js', './lib/polyfills.js'], {
		server: {
			baseDir: './'
		},
    port: 3000,
    // Don't show any notifications in the browser.
    notify: false,
    startPath: './test/'
	});

  gulp.watch([path.join(devCompileTargetDir, packageJson.name + '.bundle.js'])
    .on('change', reload);
});
