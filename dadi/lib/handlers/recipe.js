var fs = require('fs');
var path = require('path');
var PassThrough = require('stream').PassThrough;
var Promise = require('bluebird');
var url = require('url');
var _ = require('underscore');

var HandlerFactory = require(__dirname + '/../handlers/factory');
var Cache = require(__dirname + '/../cache');
var config = require(__dirname + '/../../../config');

var RecipeHandler = function (req) {
  var self = this;

  this.req = req;

  var parsedUrl = url.parse(this.req.url, true);

  this.urlParts = _.compact(parsedUrl.pathname.split('/'))

  this.recipePath = path.join(path.resolve(__dirname + '/../../../workspace/recipes/'),  this.urlParts[0] + '.json')

  fs.stat(this.recipePath, function(err, stats) {
    if (err) {
      return;
    }

    self.recipe = require(recipePath);

    var referencePath = recipe.path ? recipe.path : '';
    var url = referencePath + '/' + self.urlParts.join('/');
    self.fileName = path.basename(parsedUrl.pathname);
    self.fileExt = path.extname(parsedUrl.pathname).replace('.', '');
    self.compress = recipe.settings.compress ? recipe.settings.compress : '0';

    var factory = Object.create(HandlerFactory);
    var handler = factory.createFromFormat(self.recipe.settings.format);
  })

  //   if (fs.existsSync(path.resolve(__dirname + '/../../../workspace/recipes/' + paramString.split('/')[0] + '.json'))) {
  //     console.log('RECIPE')
    //   var recipePath = path.resolve(__dirname + '/../../../workspace/recipes/' + paramString.split('/')[0] + '.json');
    //   var recipe = require(recipePath);
    //
    //   var referencePath = recipe.path?recipe.path:'';
    //   url = referencePath + '/' + paramString.substring(paramString.split('/')[0].length + 1);
    //
    //   fileName = url.split('/')[url.split('/').length - 1];
    //   fileExt = url.substring(url.lastIndexOf('.') + 1);
    //   if(recipe.settings.format == 'js' || recipe.settings.format == 'css') {
    //     if(fileName.split('.').length == 1) {
    //       fileExt = recipe.settings.format;
    //       fileName = fileName + '.' + fileExt;
    //     }
    //     compress = recipe.settings.compress;
    //     if (compress != 0 && compress != 1) {
    //       error = '<p>Compress value should be 0 or 1.</p>';
    //       help.displayErrorPage(404, error, res);
    //     } else {
    //       assetHandler.fetchOriginFileContent(url, fileName, fileExt, compress, res);
    //     }
    //     options = {
    //       format: 'assets'
    //     };
    //   } else if(recipe.settings.format == 'fonts') {
    //     if(supportExts.indexOf(fileExt.toLowerCase()) < 0) {
    //       error = '<p>Font file type should be TTF, OTF, WOFF, SVG or EOT.</p>';
    //       help.displayErrorPage(404, error, res);
    //     } else {
    //       assetHandler.fetchOriginFileContent(url, fileName, fileExt, 0, res);
    //     }
    //     options = {
    //       format: 'assets'
    //     };
    //   } else {
    //     options = recipe.settings;
    //   }

}

RecipeHandler.prototype.get = function () {
  var self = this;

  // return new Promise(function(resolve, reject) {
  //   // attempt to open
  //   var stream = fs.createReadStream(self.getFullUrl());
  //
  //   stream.on('open', function () {
  //     // check file size
  //     var stats = fs.statSync(self.getFullUrl());
  //     var fileSize = parseInt(stats.size);
  //
  //     if (fileSize === 0) {
  //       var err = {
  //         statusCode: 404,
  //         message: 'File size is 0 bytes'
  //       }
  //
  //       return reject(err);
  //     }
  //
  //     return resolve(stream);
  //   })
  //
  //   stream.on('error', function() {
  //     var err = {
  //       statusCode: 404,
  //       message: 'File not found'
  //     }
  //
  //     return reject(err);
  //   })
  // })
}

module.exports = function (req) {
  return new RecipeHandler(req);
}

module.exports.RecipeHandler = RecipeHandler;
