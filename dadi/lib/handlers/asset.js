var compressor = require('node-minify');
var fs = require('fs');
var path = require('path');
var PassThrough = require('stream').PassThrough;
var Promise = require('bluebird');
var url = require('url');
var _ = require('underscore');

var StorageFactory = require(__dirname + '/../storage/factory');
var Cache = require(__dirname + '/../cache');
var config = require(__dirname + '/../../../config');

/**
 * Performs checks on the supplied URL and fetches the asset
 * @param {String} format - the type of asset requested
 * @param {Object} req - the original HTTP request
 */
var AssetHandler = function (format, req) {
  var self = this;

  this.supportedExtensions = ['ttf', 'otf', 'woff', 'svg', 'eot'];
  this.format = format;
  this.compress = '0';
  this.factory = Object.create(StorageFactory);
  this.cache = Cache();

  this.req = req;

  var parsedUrl = url.parse(this.req.url, true);

  // '/js/1/test.js' -> [ 'js', '1', 'test.js' ]
  // '/fonts/test.ttf' -> [ fonts', 'test.ttf' ]
  this.urlParts = _.compact(parsedUrl.pathname.split('/'))

  if (this.format === 'css' || this.format === 'js') {
    this.url = this.urlParts.slice(2).join('/');
    this.fileExt = this.format;
    this.fileName = parsedUrl.search ? this.urlParts[1] : this.urlParts[2];
    this.compress = parsedUrl.search ? parsedUrl.query.compress : this.urlParts[1];
  }
  else if (this.format === 'fonts') {
    this.url = parsedUrl.pathname.replace('/fonts','');
    this.fileName = this.urlParts[1];
    this.fileExt = path.extname(this.fileName).replace('.','');
  }

  this.cacheKey = this.urlParts.join('/');
}

AssetHandler.prototype.get = function () {
  var self = this;
  self.cached = false;

  return new Promise(function(resolve, reject) {
    var message;

    if (self.compress !== '0' && self.compress !== '1') {
      message = '<p>Url path is invalid.</p>' +
      '<p>The valid url path format:</p>' +
      '<p>http://some-example-domain.com/{format-(js, css)}/{compress-(0, 1)}/JS,CSS file path</p>';
    }

    if (self.format === 'fonts' && self.supportedExtensions.indexOf(self.fileExt.toLowerCase()) < 0) {
      message = '<p>Font file type should be TTF, OTF, WOFF, SVG or EOT.</p>';
    }

    if (message) {
      var err = {
        statusCode: 400,
        message: message
      }

      return reject(err);
    }

    // get from cache
    self.cache.get(self.cacheKey, function (stream) {
      if (stream) {
        self.cached = true;
        return resolve(stream)
      }

      var storage = self.factory.create('asset', self.url);

      console.log('GET FROM STORAGE')

      storage.get().then(function(stream) {
        // compress, returns stream
        self.compressFile(stream).then(function(stream) {
          var cacheStream = PassThrough()
          var responseStream = PassThrough()

          // duplicate the stream so we can use it for the cache request and the
          // response. this saves requesting the same data a second time.
          stream.pipe(cacheStream)
          stream.pipe(responseStream)

          self.cache.cacheFile(cacheStream, self.cacheKey, function () {
            return resolve(responseStream)
          })
        })
      }).catch(function(err) {
        return reject(err);
      })
    })
  })
}

AssetHandler.prototype.compressFile = function(stream) {
  var self = this;

  return new Promise(function(resolve, reject) {
    // no compression required, send stream back
    if (self.compress === '0') return resolve(stream);

    if (!fs.existsSync(path.resolve('./tmp'))) fs.mkdirSync(path.resolve('./tmp'));

    var compression = self.format === 'js' ? 'uglifyjs' : 'sqwish'

    var fileIn = path.join(path.resolve('./tmp'), self.fileName);
    var newFileName = self.fileName.split('.')[0] + '.min.' + self.fileExt;
    var fileOut = path.join(path.resolve('./tmp'), newFileName);

    stream.pipe(fs.createWriteStream(fileIn)).on('finish', function () {
      new compressor.minify ({
        type: compression,
        fileIn: fileIn,
        fileOut: fileOut,
        callback: function (err, min) {
          if (err) {
            console.log(err)
            //help.displayErrorPage(404, err, res);
          }
          else {
            fs.unlinkSync(fileIn);
            stream = fs.createReadStream(fileOut);

            stream.on('open', function() {
              return resolve(stream)
            })

            stream.on('close', function() {
              fs.unlink(fileOut);
            })
          }
        }
      })
    })
  })
}

module.exports = function (format, req) {
  return new AssetHandler(format, req);
}

module.exports.AssetHandler = AssetHandler;
