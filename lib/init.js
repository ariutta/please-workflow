// Ensure the config files and the desired directory structure is present.

/* This should implement these steps:
 * A) Does package.json exist?
 *    1) Yes
 *       a) In current directory: use it
 *       b) In a parent directory: ask whether to use it or create a new one
 *    2) No: ask whether to init new project. If yes, run npm init; then read result
 * B) Does package.json have a pleaseWorkflow property with settings?
 *    1) Yes: read it
 *    2) No: give prompts required to make it; then add it to packageJson
 *       a) browser-only, node-only or both?
 *          i) if browser, what kind of entry point?
 *              - vanilla js
 *              - web component
 *              - jQuery
 *              - other(s)
 *       b) small (just index.js) or large (lib dir)?
 *       c) JS or TypeScript?
 *       d) CLI included?
 *       e) modernizr feature detects required
 * C) Based on the pleaseWorkflow settings, check the following and create if needed:
 *    1) required files/dirs are present
 *       a) small
 *          i) ...
 *       b) large
 *          i) lib dir
 *       c) both
 *          i) test dir
 *          ii) docs dir
 *          iii) demo dir
 *          iv) bin dir with cli.js file?
 *    2) .gitignore is ignoring what it needs to
 *    3) linter settings are specified
 *    4) npm dependencies are specified in package.json
 * D) Save package.json, if updated
 */

'use strict';

require('pretty-error').start();
var _ = require('lodash');
var findPkg = require('witwip');
var init = require('init-package-json');
var inquirer = require('inquirer');
var mkdirp = require('mkdirp');
var path = require('path');

var RxNode = require('rx-node-extra');
var Rx = RxNode.Rx;
var RxFs = require('rx-fs');

var VError = require('verror');

var pleaseWorkflowDir = path.join(__dirname, '..');
var defaultConfigFilesDir = path.join(pleaseWorkflowDir, 'default-config-files');

var cwd = process.cwd();

function createPackageJson() {
  var initFile = path.resolve(process.env.HOME, '.npm-init');
  return Rx.Observable.fromNodeCallback(init)(cwd, initFile);
}

var rxFindPkg = Rx.Observable.fromNodeCallback(findPkg, undefined, function(pkgPath, pkgData) {
  return {
    pkgPath: pkgPath,
    pkgData: pkgData
  };
});

function createFindPkgResponse(packageJson) {
  return {
    pkgPath: cwd + '/package.json',
    pkgData: packageJson
  };
}

/**
 * getPackageMetadata
 *
 * Read metadata about this package, creating it if needed.
 *
 * Does package.json exist?
 *    1) Yes
 *       a) If found in current directory, use it
 *       b) If found in a ([great-...]grand)parent directory, ask whether to
 *          - use it or
 *          - create a new one
 *    2) No
 *       a) Ask whether to init new project. If yes, run npm init; then read result
 *
 * @return {object} findPkgResponse matches what findPkg/witwip response
 *                  findPkgResponse.pkgPath {string} path to package.json
 *                  findPkgResponse.pkgData {object} parsed JSON from package.json
 *                  [findPkgResponse.readme] {string}
 *                  [...] other metadata from findPkg (witwip)
 */
function getPackageMetadata() {
  return rxFindPkg(process.cwd())
    .catch(function(err) {
      if (err.code === 'ENOENT') {
        return Rx.Observable.return(undefined);
      } else {
        var message = 'Error with rxFindPkg';
        var newError = new VError(err, message);
        console.error(newError.stack);
        return Rx.Observable.throw(newError);
      }
    })
    .concatMap(function(result) {
      if (!result) {
        return RxNode.ask(function() {
          return [{
            name: 'runNpmInit',
            type: 'confirm',
            message: 'No package.json found. Run "npm init" in "' + cwd + '"?',
            default: false
          }];
        })
        .concatMap(function(response) {
          if (response.runNpmInit) {
            return createPackageJson()
              .map(createFindPkgResponse);
          } else {
            return Rx.Observable.empty();
          }
        });
      }

      var packageJson = result.pkgPath;
      var foundProjectDir = path.dirname(packageJson);
      if (foundProjectDir === cwd) {
        return Rx.Observable.return(result);
      } else {
        return RxNode.ask(function() {
          return [{
            name: 'answer',
            type: 'list',
            message: 'No package.json found in "' + cwd + '". Choose an option below.',
            choices: [{
              name: 'Use "' + packageJson + '"',
              value: 'use',
              short: 'Use existing'
            }, {
              name: 'Run "npm init" in "' + cwd + '"',
              value: 'init',
              short: 'create new'
            }, {
              name: 'Cancel',
              value: 'cancel'
            }],
            default: 'cancel'
          }];
        })
        .concatMap(function(response) {
          var answer = response.answer;
          if (answer === 'use') {
            return Rx.Observable.return(result);
          } else if (answer === 'init') {
            return createPackageJson()
              .map(createFindPkgResponse);
          } else if (answer === 'cancel') {
            return Rx.Observable.empty();
          } else {
            return Rx.Observable.throw(new Error('Bad option: "' + answer + '" not recognized.'));
          }
        });
      }
    });
}

/**
 * updateFs
 *
 * @param findPkgResponse
 * @return {undefined}
 */
function updateFs(findPkgResponse) {
  var packageJson = findPkgResponse.pkgData;
  var pleaseWorkflowSettings = packageJson.pleaseWorkflow;
  var packageJsonPath = findPkgResponse.pkgPath;
  var projectDir = path.dirname(packageJsonPath);

  var defaultConfigFilenameSource = RxFs.readdir(defaultConfigFilesDir)
    .map(function(filenameList) {
      return Rx.Observable.fromArray(filenameList);
    })
    .mergeAll()
    .toArray();

  var projectDirContentSource = RxFs.readdir(projectDir)
    .map(function(filenameList) {
      return Rx.Observable.fromArray(filenameList);
    })
    .mergeAll()
    // TODO how do we filter out directories?
    //.filter(function(filename) {
    // return isFile(filename);
    //})
    //
    .toArray();

  var neededDirPathList = [
    path.join(projectDir, 'demo'),
    path.join(projectDir, 'docs'),
    path.join(projectDir, 'dist'),
    path.join(projectDir, 'test'),
    path.join(projectDir, 'test', 'lib')
  ];

  if (pleaseWorkflowSettings.size === 'large') {
    neededDirPathList = neededDirPathList.concat([
      path.join(projectDir, 'lib')
    ]);
  }

  if (pleaseWorkflowSettings.cli) {
    neededDirPathList = neededDirPathList.concat([
      path.join(projectDir, 'bin')
    ]);
  }

  var packageJsonString = JSON.stringify(packageJson, null, '  ');
  RxFs.writeFile(packageJsonPath, packageJsonString, {encoding: 'utf8'})
    .subscribe(function(value) {
      // do something
    }, function(err) {
      throw err;
    });

  var fileEdits = {
    'jsdoc-conf.json': function(contents) {
      var jsonContents = JSON.parse(contents);
      jsonContents.templates.applicationName = packageJson.name;
      var jsonString = JSON.stringify(jsonContents, null, '  ');
      return Rx.Observable.return(jsonString);
    }
  };
  var filesToEditNames = _.keys(fileEdits);

  // Ensure config files are present. Create them if they are not.
  var filenamesPartitionedByEditStatusSource = Rx.Observable.zip(
      defaultConfigFilenameSource,
      projectDirContentSource,
      function(defaultConfigFilenameList, projectDirContentList) {
        return _.difference(defaultConfigFilenameList, projectDirContentList);
      })
    .map(function(filenameList) {
      return Rx.Observable.fromArray(filenameList);
    })
    .mergeAll()
    .partition(function(filename) {
      return filesToEditNames.indexOf(filename) > -1;
    });

  var filesToEditNameSource = filenamesPartitionedByEditStatusSource[0]
    .flatMap(function(filename) {
      var edit = fileEdits[filename];
      var sourcePath = path.join(defaultConfigFilesDir, filename);
      var destPath = path.join(projectDir, filename);
      return RxFs.readFile(sourcePath, {encoding: 'utf8'})
        .flatMap(edit)
        .doOnNext(function(contents) {
          return RxFs.writeFile(destPath, contents, {encoding: 'utf8'})
            .subscribe(function(value) {
            }, function(err) {
              throw err;
            }, function() {
              // on complete
            });
        });
    })
    .defaultIfEmpty(Rx.Observable.return(true));

  var filesNotToEditNameSource = filenamesPartitionedByEditStatusSource[1]
    .doOnNext(function(filename) {
      var sourcePath = path.join(defaultConfigFilesDir, filename);
      var destPath = path.join(projectDir, filename);
      RxFs.createReadObservable(sourcePath).pipe(RxFs.createWriteStream(destPath));
    })
    .defaultIfEmpty(Rx.Observable.return(true));

  var configFileSource = Rx.Observable.concat(
      filesToEditNameSource,
      filesNotToEditNameSource
    );

  configFileSource
    .subscribe(function(value) {
    }, function(err) {
      throw err;
    }, function() {
      // Ensure desired directory structure is present. Create the directories if not present.
      Rx.Observable.concat(
        Rx.Observable.from(neededDirPathList)
      )
        .doOnNext(function(neededDirPath) {
          //console.log('Creating ' + neededDirPath + '...');
          mkdirp.sync(neededDirPath);
        })
        .subscribe(function(neededDirPath) {
          // on each
        }, function(err) {
          throw err;
        }, function() {
          console.log('PleaseWorkflow Initialization Complete.');
        });
    });
}

getPackageMetadata()
  .concatMap(function(findPkgResponse) {
    var packageJson = findPkgResponse.pkgData;
    var pleaseWorkflowSettings = packageJson.pleaseWorkflow;
    if (!_.isEmpty(pleaseWorkflowSettings)) {
      return Rx.Observable.return(findPkgResponse);
    }

    return RxNode.ask(function() {
      return [{
        name: 'env',
        type: 'checkbox',
        message: 'Where will this be used?',
        choices: ['browser', 'node'],
        default: ['browser']
      }, {
        name: 'size',
        type: 'list',
        message: 'What size is this project?',
        choices: [{
          name: 'Small: all code is a single index.js file',
          value: 'small',
          short: 'small'
        }, {
          name: 'Large: multiple files in a lib dir.',
          value: 'large',
          short: 'large'
        }],
        default: 'small'
      }, {
        name: 'language',
        type: 'list',
        message: 'What language?',
        choices: ['typescript', 'javascript'],
        default: 'typescript'
      }, {
        name: 'cli',
        type: 'confirm',
        message: 'CLI to be included?',
        default: false
      }
      /*, {
        // TODO figure out how to handle this.
        // Might want to look at the actual code (with modernizr or something like autopolyfill)
        // to see what we need in terms of feature detection and polyfills, but
        // then how do we handle dependencies?
        name: 'modernizrFeatureDetects',
        type: 'checkbox',
        message: 'Select modernizrFeatureDetects\n',
        choices: ['promise', 'map']
      }//*/
     ];
    })
    .doOnNext(function(response) {
      response.env = _.isArray(response.env) ? response.env : [response.env];
      packageJson.pleaseWorkflow = response;
      updateFs(findPkgResponse);
    });
    /* TODO figure out how to set up demos. Should they be based on node vs. browser, with
    // browser having vanilla, jQuery and web-component demos?
    .concatMap(function(response) {
      response.env = _.isArray(response.env) ? response.env : [response.env];

      packageJson.pleaseWorkflow = response;

      if (response.env.indexOf('browser') === -1) {
        return Rx.Observable.return(findPkgResponse);
      }

      return RxNode.ask(function() {
        return [{
          name: 'integrationsResult',
          type: 'checkbox',
          message: 'What kinds of browser example integrations will be included?',
          choices: [{
            name: 'vanilla JS',
            value: 'vanilla'
          }, {
            name: 'web component',
            value: 'web-component'
          }, {
            name: 'jQuery',
            value: 'jquery'
          }, {
            name: 'other',
            value: 'other',
          }],
          default: 'vanilla'
        }];
      })
      .map(function(integrationsResult) {
        packageJson.pleaseWorkflow.integrations = integrationsResult.integrations;
        return findPkgResponse;
      });
    });
    //*/
  })
  .subscribe(function(result) {
    // do something
  }, function(err) {
    var message = 'Error with getPackageMetadata';
    var newError = new VError(err, message);
    console.error(newError.stack);
  });
