var nodeUrl = require('url');
var _ = require('underscore');
var AssetHandler = require(__dirname + '/asset');
var ImageHandler = require(__dirname + '/image');
var RecipeHandler = require(__dirname + '/recipe');

var config = require(__dirname + '/../../../config');

module.exports = {
  create: function create(format, url) {

    switch (format) {
      case 'css':
      case 'fonts':
      case 'js':
        return new AssetHandler(format, url)
        break
      case 'gif':
      case 'jpg':
      case 'png':
        return new ImageHandler(format, url)
        break
      case 'recipe':
        return new RecipeHandler(format, url)
        break
      default:
        //return new UnknownHandler(format)
        return null
        break
    }
  }
}
