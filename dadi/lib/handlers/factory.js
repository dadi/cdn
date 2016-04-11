var fs = require('fs');
var path = require('path');
var url = require('url');
var _ = require('underscore');
var AssetHandler = require(__dirname + '/asset');
var ImageHandler = require(__dirname + '/image');

var config = require(__dirname + '/../../../config');

//var format = getFormat(version, parsedUrl);

function parseUrl(req) {
  return url.parse(req.url, true);
}

function getFormat(version, req) {
  var parsedPath = parseUrl(req).pathname;

  if (version === 'v1') {
    return _.compact(parsedPath.split('/'))[0];
  }
  else if (version === 'v2') {
    return path.extname(parsedPath).replace('.', '')
  }
}

var HandlerFactory = function() {}

HandlerFactory.prototype.create = function(req, cb) {
    // set a default version
    var version = 'v1'

    // set version 2 if the url was supplied with a querystring
    if (require('url').parse(req.url, true).search) {
      version = 'v2'
    }

    var format = getFormat(version, req)

    console.log('create: ' + format)

    this.createFromFormat(format, req, function(handler) {
      return cb(handler)
    })
}

HandlerFactory.prototype.createFromFormat = function(format, req, cb) {
var self = this;
    console.log('createFromFormat: ' + format)
    switch (format) {
      case 'css':
      case 'fonts':
      case 'js':
        return cb(new AssetHandler(format, req))
        break
      case 'gif':
      case 'jpg':
      case 'json':
      case 'png':
        return cb(new ImageHandler(format, req))
        break
      default:
        this.createFromRecipe(format, req, function(handler) {
          return cb(handler)
        })
        break
    }
}

HandlerFactory.prototype.createFromRecipe = function(format, req, cb) {
var self = this;
  var recipePath = path.join(path.resolve(__dirname + '/../../../workspace/recipes/'),  format + '.json')

  fs.stat(recipePath, function(err, stats) {
    if (err) {
      return;
    }

    var recipe = require(recipePath);
console.log(recipe)
    
    self.createFromFormat(recipe.settings.format, req, function(handler) {
      var referencePath = recipe.path ? recipe.path : '';
      var filePath = parseUrl(req).pathname.replace(format,'');
      var fullPath = path.join(referencePath, filePath);
      handler.url = fullPath;
      handler.fileName = path.basename(parseUrl(req).pathname.replace(format,''));
      handler.fileExt = path.extname(parseUrl(req).pathname).replace('.', '');
      handler.compress = recipe.settings.compress ? recipe.settings.compress.toString() : '0';
      handler.options = recipe.settings;
      console.log(handler)
      cb(handler);
    })
  })
}

module.exports = function () {
  return new HandlerFactory();
}

module.exports.HandlerFactory = HandlerFactory;
