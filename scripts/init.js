// Ensure the config files and the desired directory structure is present.

//var gulp = require(__dirname + '/../../gulp');
var _ = require('lodash');
var fs = require('fs');
var inquirer = require('inquirer');
var JSONStream = require('JSONStream');
var mkdirp = require('mkdirp');
var path = require('path');
var Rx = require('rx');
var RxNode = require('rx-node');
var utils = require('../util/utils.js');

var workflowBobDir = path.join(__dirname, '..');
var dependentProjectDir = path.join(__dirname, '..', '..', '..');
var defaultConfigFilesDir = path.join(workflowBobDir, 'default-config-files');

var packageJson = require(dependentProjectDir + '/package.json');
var workflowBobJson = require(defaultConfigFilesDir + '/workflow-bob.json');

var defaultConfigFilenameSource = utils.readdirSource(defaultConfigFilesDir)
  .map(function(filenameList) {
    return Rx.Observable.fromArray(filenameList);
  })
  .mergeAll()
  .toArray();

var dependentProjectDirContentSource = utils.readdirSource(dependentProjectDir)
  .map(function(filenameList) {
    return Rx.Observable.fromArray(filenameList);
  })
  .mergeAll()
  /* TODO how do we filter out directories?
  .filter(function(filename) {
    return isFile(filename);
  })
  //*/
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
  'workflow-bob.json': function(contentString) {
    workflowBobJson = JSON.parse(contentString);
    var metadataFilePaths = workflowBobJson.metadataFilePaths;
    var metadataFilePathsSeparator = ', ';
    var modernizrFeatureDetects = workflowBobJson.modernizrFeatureDetects;
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
        workflowBobJson[promptResponse.name] = promptResponse.answer;
        return true;
      })
      .toArray()
      .map(function() {
        var jsonString = JSON.stringify(workflowBobJson, null, '  ');
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

function getWorkflowBobDemoIntegrations() {
  var prompts = Rx.Observable.from([{
    type: 'checkbox',
    name: 'integrations',
    message: 'Select integrations',
    choices: workflowBobJson.integrations
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
      getWorkflowBobDemoIntegrations()
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
        console.log('WorkflowBob Initialization Complete.');
      });
  });
