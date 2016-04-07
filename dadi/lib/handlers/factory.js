var url = require('url');
var _ = require('underscore');
var AssetHandler = require(__dirname + '/asset');
var ImageHandler = require(__dirname + '/image');
var RecipeHandler = require(__dirname + '/recipe');

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

module.exports = {
  create: function create(req) {
    // set a default version
    var version = 'v1'

    // set version 2 if the url was supplied with a querystring
    if (require('url').parse(req.url, true).search) {
      version = 'v2'
    }

    var format = getFormat(version, req)

    switch (format) {
      case 'css':
      case 'fonts':
      case 'js':
        return new AssetHandler(format, req)
        break
      case 'gif':
      case 'jpg':
      case 'png':
        return new ImageHandler(format, req)
        break
      case 'recipe':
        return new RecipeHandler(format, req)
        break
      default:
        //return new UnknownHandler(format)
        return null
        break
    }
  }
}

