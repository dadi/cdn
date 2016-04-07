var path = require('path');
var Promise = require('bluebird');
var _ = require('underscore');

var config = require(__dirname + '/../../../config');

/**
 * Performs checks on the supplied URL and fetches the asset
 * @param {String} format - the type of asset requested
 * @param {Object} url - the parsed URL. Contains path and query
 */
var AssetHandler = function (format, url) {
  var self = this;

  this.supportedExtensions = ['ttf', 'otf', 'woff', 'svg', 'eot'];
  this.format = format;
  this.compress = 0;

  // '/js/1/test.js' -> [ 'js', '1', 'test.js' ]
  // '/fonts/test.ttf' -> [ fonts', 'test.ttf' ]
  this.urlParts = _.compact(url.pathname.split('/'))

  if (this.format === 'css' || this.format === 'js') {
    this.fileExt = this.format;
    this.fileName = this.urlParts[2];
    this.compress = this.urlParts[1];
  }
  else if (this.format === 'fonts') {
    this.url = this.urlParts.join('/');
    this.fileName = this.urlParts[1];
    this.fileExt = path.extname(this.fileName).replace('.','');
  }

  this.url = paramString.substring(paramString.split('/')[0].length + 3);

//  if (fileName.split('.').length == 1) fileName = fileName + '.' + fileExt;

 //else {
  //  assetHandler.fetchOriginFileContent(url, fileName, fileExt, compress, res);
  //}
  // this.url = nodeUrl.parse(url, true).pathname;
  // this.path = path.resolve(config.get('images.directory.path'));

  // this.getFullUrl = function() {
  //   return path.join(self.path, self.url.replace('/disk', ''))
  // }
}

AssetHandler.prototype.get = function () {
  var self = this;

  return new Promise(function(resolve, reject) {

    var message;

    if (this.compress !== 0 && this.compress !== 1) {
      message = '<p>Url path is invalid.</p>' +
      '<p>The valid url path format:</p>' +
      '<p>http://some-example-domain.com/{format-(js, css)}/{compress-(0, 1)}/JS,CSS file path</p>';
    }

    if (this.format === 'fonts' && this.supportedExtensions.indexOf(this.fileExt.toLowerCase()) < 0) {
      message = '<p>Font file type should be TTF, OTF, WOFF, SVG or EOT.</p>';
    }

    if (message) {
      var err = {
        statusCode: 400,
        message: message
      }

      return reject(err);
    }

    return resolve('ASSET');
  })
}

module.exports = function (format, url) {
  return new AssetHandler(format, url);
}

module.exports.AssetHandler = AssetHandler;
