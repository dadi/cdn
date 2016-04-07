var compressor = require('node-minify');
var path = require('path');
var Promise = require('bluebird');
var url = require('url');
var _ = require('underscore');

var StorageFactory = require(__dirname + '/../storage/factory');
var AssetHandle = require(__dirname + '/../assethandle');
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
  this.assetHandler = AssetHandle(null, null);

  this.req = req;

  // '/js/1/test.js' -> [ 'js', '1', 'test.js' ]
  // '/fonts/test.ttf' -> [ fonts', 'test.ttf' ]
  this.urlParts = _.compact(url.parse(this.req.url, true).pathname.split('/'))

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

    var storage = self.factory.create('asset', self.req);

    console.log(storage)

    storage.get().then(function(stream) {

      console.log(stream)

      // compress, returns stream
      self.compress(stream).then(function(stream) {
        // cache
        self.cache.cacheJSCSSFiles(stream, sha1(self.fileName), function () {
          return resolve(stream)
        });
      })
    })
      // return

      // var imageSizeStream = PassThrough()
      // var responseStream = PassThrough()

      // duplicate the stream so we can use it
      // for the imagesize() request and the
      // response. this saves requesting the same
      // data a second time.
      // stream.pipe(imageSizeStream)
      // stream.pipe(responseStream)

    //   imagesize(imageSizeStream, function(err, imageInfo) {
    //     self.convertAndSave(responseStream, imageInfo, originFileName, newFileName, options, returnJSON, res);
    //   });
    // }).catch(function(err) {
    //   help.displayErrorPage(err.statusCode, err.message, res);
    // });

    //return resolve('ASSET');
  })
}

AssetHandler.prototype.compress = function(stream) {
  var self = this;

  return new Promise(function(resolve, reject) {

    // no compression required, send stream back
    if (this.compress === 0) return resolve(stream);

    if (!fs.existsSync(path.resolve('./tmp'))) fs.mkdirSync(path.resolve('./tmp'));

    var compression = this.format === 'js' ? 'uglifyjs' : 'sqwish'

    var fileIn = path.join(path.resolve('./tmp'), this.fileName);
    var newFileName = this.fileName.split('.')[0] + '.min.' + this.fileName.split('.')[1];
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
