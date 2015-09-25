var exec = require('child_process').exec;
var fs = require('fs');
var highland = require('highland');
var inquirer = require('inquirer');
var mkdirp = require('mkdirp');
var Rx = require('rx');
var RxNode = require('rx-node');

var createExecStream = highland.wrapCallback(exec);
var createExecSource = Rx.Observable.fromNodeCallback(exec);

var utils = {};

utils.createPromptStream = highland.wrapCallback(inquirer.prompt);
utils.createExecStream = createExecStream;
utils.createMkdirpStream = highland.wrapCallback(mkdirp);

utils.fsReadOrCreate = function(filePath) {
  return highland.wrapCallback(fs.open)(filePath, 'a')
    .flatMap(function(fd) {
      return highland.wrapCallback(fs.close)(fd);
    })
    .flatMap(function() {
      return highland.wrapCallback(fs.readFile)(filePath, 'utf8');
    });
};

utils.createExecSource = createExecSource;
utils.createMkdirpSource = Rx.Observable.fromNodeCallback(mkdirp);

utils.fsReadOrCreateSource = function(filePath) {
  return Rx.Observable.fromNodeCallback(fs.open)(filePath, 'a')
    .flatMap(function(fd) {
      return Rx.Observable.fromNodeCallback(fs.close)(fd);
    })
    .flatMap(function() {
      return Rx.Observable.fromNodeCallback(fs.readFile)(filePath, 'utf8');
    });
};

utils.readdirSource = Rx.Observable.fromNodeCallback(fs.readdir);

module.exports = utils;
