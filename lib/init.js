// Ensure the config files and the desired directory structure is present.

'use strict';

require('pretty-error').start();
//var gulp = require(__dirname + '/../../gulp');
var _ = require('lodash');
var findPkg = require('witwip');
//var fs = require('fs');
var init = require('init-package-json');
var inquirer = require('inquirer');
var JSONStream = require('JSONStream');
var mkdirp = require('mkdirp');
var path = require('path');

var RxNode = require('rx-node-extra');
var Rx = RxNode.Rx;
var RxFs = require('rx-fs');
var rxJSONStream = require('rx-json-stream');

var VError = require('verror');

var pleaseWorkflowDir = path.join(__dirname, '..');
var defaultConfigFilesDir = path.join(pleaseWorkflowDir, 'default-config-files');

var cwd = process.cwd();

function createPackageJson() {
  var initFile = path.resolve(process.env.HOME, '.npm-init');
  return Rx.Observable.fromNodeCallback(init)(cwd, initFile);
}

/* TODO make this implement these steps:
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

// TODO The code below is a start for completing the objectives above, but it is old,
// so it still expects a separate file for the pleaseWorkflow settings. It is commented
// out until I can determine that it works correctly.

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
 * @return {object} result
 *                  result.pkgPath {string} path to package.json
 *                  result.pkgData {object} parsed JSON from package.json
 *                  [result.readme] {string}
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

function updateFs(packageJson, packageJsonPath) {
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
    path.join(projectDir, 'lib'),
    path.join(projectDir, 'demo'),
    path.join(projectDir, 'docs'),
    path.join(projectDir, 'dist'),
    path.join(projectDir, 'test'),
    path.join(projectDir, 'test', 'lib')
  ];

  var fileEdits = {
    'jsdoc-conf.json': function(contents) {
      var jsonContents = JSON.parse(contents);
      jsonContents.templates.applicationName = packageJson.name;
      var jsonString = JSON.stringify(jsonContents, null, '  ');
      return Rx.Observable.return(jsonString);
    },
    'package.json': function() {
      var pleaseWorkflowSettings = packageJson.pleaseWorkflow;
      var modernizrFeatureDetects = pleaseWorkflowSettings.modernizrFeatureDetects =
        pleaseWorkflowSettings.modernizrFeatureDetects || {};
      // TODO move this out of this function. This function does just fs writing.
      var prompts = Rx.Observable.from([
        {
          // TODO figure out how to handle this.
          // Might want to look at the actual code (with modernizr or something like autopolyfill)
          // to see what we need in terms of feature detection and polyfills, but
          // then how do we handle dependencies?
          type: 'checkbox',
          name: 'modernizrFeatureDetects',
          message: 'Select modernizrFeatureDetects\n',
          choices: modernizrFeatureDetects
        }
      ]);

      return inquirer.prompt(prompts).process
        .map(function(promptResponse) {
          packageJson.pleaseWorkflowSettings[promptResponse.name] = promptResponse.answer;
          return true;
        })
        .toArray()
        .map(function() {
          var jsonString = JSON.stringify(packageJson, null, '  ');
          return jsonString;
        });
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
  .concatMap(function(result) {
    var packageJson = result.pkgData;
    var packageJsonPath = result.pkgPath;
    var pleaseWorkflow = packageJson.pleaseWorkflow;
    if (!_.isEmpty(pleaseWorkflow)) {
      return Rx.Observable.result;
    }

 /*       a) browser-only, node-only or both?
 *          i) if browser, what kind of entry point?
 *              - vanilla js
 *              - web component
 *              - jQuery
 *              - other(s)
 *       b) small (just index.js) or large (lib dir)?
 *       c) JS or TypeScript?
 */
    return RxNode.ask(function() {
      return [{
        name: 'env',
        type: 'list',
        message: 'Where will this be used?',
        choices: ['browser', 'node'],
        default: 'browser'
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
      }];
    })
    .doOnNext(function(response) {
      response.env = _.isArray(response.env) ? response.env : [response.env];
      packageJson.pleaseWorkflow = response;
      updateFs(packageJson, packageJsonPath);
    });
    /* TODO figure out how to set up demos. Should they be based on node vs. browser, with
    // browser having vanilla, jQuery and web-component demos?
    .concatMap(function(response) {
      response.env = _.isArray(response.env) ? response.env : [response.env];

      packageJson.pleaseWorkflow = response;

      if (response.env.indexOf('browser') === -1) {
        return Rx.Observable.return(result);
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
        return result;
      });
    });
    //*/
  })
  .subscribe(function(result) {
    console.log('result');
    console.log(result);
  }, function(err) {
    console.log('err');
    console.log(err);
  });

/*
function init(packageJsonPath, dependentProjectDir) {
  var packageJson = require(packageJsonPath);
  // TODO just make this an entry in package.json, not its own file.
  var pleaseWorkflowSettings = require(defaultConfigFilesDir + '/please-workflow.json');

  var defaultConfigFilenameSource = RxFs.readdir(defaultConfigFilesDir)
    .map(function(filenameList) {
      return Rx.Observable.fromArray(filenameList);
    })
    .mergeAll()
    .toArray();

  var dependentProjectDirContentSource = RxFs.readdir(dependentProjectDir)
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
    path.join(dependentProjectDir, 'lib'),
    path.join(dependentProjectDir, 'demo'),
    path.join(dependentProjectDir, 'docs'),
    path.join(dependentProjectDir, 'dist'),
    path.join(dependentProjectDir, 'test'),
    path.join(dependentProjectDir, 'test', 'lib')
  ];

  var fileEdits = {
    'jsdoc-conf.json': function(contents) {
      var jsonContents = JSON.parse(contents);
      jsonContents.templates.applicationName = packageJson.name;
      var jsonString = JSON.stringify(jsonContents, null, '  ');
      return Rx.Observable.return(jsonString);
    },
    // TODO just make this an entry in package.json, not its own file.
    'please-workflow.json': function(contentString) {
      pleaseWorkflowSettings = JSON.parse(contentString);
      var metadataFilePaths = pleaseWorkflowSettings.metadataFilePaths;
      var metadataFilePathsSeparator = ', ';
      var modernizrFeatureDetects = pleaseWorkflowSettings.modernizrFeatureDetects;
      var prompts = Rx.Observable.from([
        {
          // TODO figure out how to handle this.
          // Might want to look at the actual code (with modernizr or something like autopolyfill)
          // to see what we need in terms of feature detection and polyfills, but
          // then how do we handle dependencies?
          type: 'checkbox',
          name: 'modernizrFeatureDetects',
          message: 'Select modernizrFeatureDetects\n',
          choices: modernizrFeatureDetects
        },
        {
          type: 'input',
          name: 'metadataFilePaths',
          message: 'Enter metadata filepaths, separated by "' + metadataFilePathsSeparator + '"\n',
          default: metadataFilePaths.join(metadataFilePathsSeparator),
          validate: function(input) {
            var inputArray = input.split(metadataFilePathsSeparator);

            // Declare function as asynchronous, and save the done callback
            var done = this.async();

            // Do async stuff
            // TODO verify that the specified files exist
            setTimeout(function() {
              if (!inputArray.length) {
                // Pass the return value in the done callback
                done('You need to provide one or more metadata file paths');
                return;
              }
              // Pass the return value in the done callback
              done(true);
            }, 5);
          }
        }
      ]);

      return inquirer.prompt(prompts).process
        .map(function(promptResponse) {
          pleaseWorkflowSettings[promptResponse.name] = promptResponse.answer;
          return true;
        })
        .toArray()
        .map(function() {
          var jsonString = JSON.stringify(pleaseWorkflowSettings, null, '  ');
          return jsonString;
        });
    }
  };
  var filesToEditNames = _.keys(fileEdits);

  // Ensure config files are present. Create them if they are not.
  var filenamesPartitionedByEditStatusSource = Rx.Observable.zip(
      defaultConfigFilenameSource,
      dependentProjectDirContentSource,
      function(defaultConfigFilenameList, dependentProjectDirContentList) {
        return _.difference(defaultConfigFilenameList, dependentProjectDirContentList);
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
      var destPath = path.join(dependentProjectDir, filename);
      return Rx.Observable.fromNodeCallback(fs.readFile)(sourcePath, {encoding: 'utf8'})
        .flatMap(edit)
        .doOnNext(function(contents) {
          return Rx.Observable.fromNodeCallback(fs.writeFile)(
              destPath, contents, {encoding: 'utf8'})
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
      var destPath = path.join(dependentProjectDir, filename);
      var readStream = fs.createReadStream(sourcePath);
      var writeStream = fs.createWriteStream(destPath);
      readStream.pipe(writeStream);
    })
    .defaultIfEmpty(Rx.Observable.return(true));

  var configFileSource = Rx.Observable.concat(
      filesToEditNameSource,
      filesNotToEditNameSource
    );

  function getDemoIntegrations() {
    var prompts = Rx.Observable.from([{
      type: 'checkbox',
      name: 'integrations',
      message: 'Select integrations',
      choices: pleaseWorkflowSettings.integrations
    }]);

    return inquirer.prompt(prompts).process
      .concatMap(function(values) {
        return Rx.Observable.from(values.answer)
          .map(function(integration) {
            return path.join(dependentProjectDir, 'test', integration + '-demos');
          });
      });
  }

  configFileSource
    .subscribe(function(value) {
    }, function(err) {
      throw err;
    }, function() {
      // Ensure desired directory structure is present. Create the directories if not present.
      Rx.Observable.concat(
        Rx.Observable.from(neededDirPathList),
        getDemoIntegrations()
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
//*/
