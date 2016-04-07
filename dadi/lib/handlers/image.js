var fs = require('fs');
var ColorThief = require('color-thief');
var colorThief = new ColorThief();
var imagemagick = require('imagemagick-native');
var imagesize = require('imagesize');
var lengthStream = require('length-stream');
var PassThrough = require('stream').PassThrough;
var path = require('path');
var Promise = require('bluebird');
var request = require('request');
var sharp = require('sharp');
var url = require('url');
var zlib = require('zlib');
var _ = require('underscore');

var StorageFactory = require(__dirname + '/../storage/factory');
var ImageHandle = require(__dirname + '/../imagehandle');
var Cache = require(__dirname + '/../cache');
var config = require(__dirname + '/../../../config');

/**
 * Performs checks on the supplied URL and fetches the image
 * @param {String} format - the type of image requested
 * @param {Object} req - the original HTTP request
 */
var ImageHandler = function (format, req) {
  var self = this;

  this.req = req;
  this.factory = Object.create(StorageFactory);
  this.cache = Cache();

  var parsedUrl = url.parse(this.req.url, true);
  this.cacheKey = parsedUrl.pathname;
  this.fileName = path.basename(parsedUrl.pathname);
  this.fileExt = path.extname(this.fileName).substring(1);

  if (parsedUrl.query) {
    this.options = parsedUrl.query;
    if (typeof this.options.format === 'undefined') this.options.format = this.fileExt;
  }
  else {
    var optionsArray = parsedUrl.pathname.split('/').slice(0, 17);
    //url = paramString.substring(optionsArray.join('/').length + 1);
    // fileName = url.split('/')[url.split('/').length - 1];
    // fileExt = url.substring(url.lastIndexOf('.') + 1);
    this.options = getImageOptions(optionsArray);
  }

  this.format = this.options.format;
}

ImageHandler.prototype.get = function () {
  var self = this;

  return new Promise(function(resolve, reject) {
    var message;

    // TODO: is there an error to raise here?
    if (message) {
      var err = {
        statusCode: 400,
        message: message
      }

      return reject(err);
    }

    var storage = self.factory.create('image', self.req);

    storage.get().then(function(stream) {
      var imageSizeStream = PassThrough()
      var responseStream = PassThrough()

      // duplicate the stream so we can use it
      // for the imagesize() request and the
      // response. this saves requesting the same
      // data a second time.
      stream.pipe(imageSizeStream)
      stream.pipe(responseStream)

      imagesize(imageSizeStream, function(err, imageInfo) {
        // originFileName = 01.jpg
        // modelName = full URL pathname = /jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/cdn-media/01.jpg
        self.convert(responseStream, imageInfo).then(function(stream) {
          // cache here
          self.cache.cacheFile(stream, self.cacheKey, function () {
            return resolve(stream)
          })
        })
      })
    }).catch(function(err) {
      return reject(err);
    })
  })
}

/**
 * Convert image according to options specified
 * @param {stream} stream - read stream from S3, local disk or url
 */
ImageHandler.prototype.convert = function (stream, imageInfo) {
  var self = this;

  return new Promise(function(resolve, reject) {
    //var encryptName = sha1(self.cacheKey);
    var options = self.options;
    var displayOption = options;

    var dimensions = getDimensions(options);

    var magickVar = imagemagick.streams.convert(options);
    magickVar.on('error', function (err) {
      return reject(err);
    });

    var sharpStream = null;

    if(options.quality >= 70 && options.format.toLowerCase() == 'png') {
      sharpStream = sharp().png().compressionLevel(9);
    } else if(options.quality >= 70 && (options.format.toLowerCase() == 'jpg' || options.format.toLowerCase() == 'jpeg')){
      sharpStream = sharp().flatten().jpeg().compressionLevel(9);
    } else if(options.cropX && options.cropY) {
      sharpStream = sharp();
    }

    if(imageInfo.format.toLowerCase() == 'gif') {
      readStream = readStream.pipe(imagemagick.streams.convert({format: options.format}));
    }

    var convertedStream = null;
    if(sharpStream != null) {
      convertedStream = readStream.pipe(sharpStream);
      if(options.cropX && options.cropY) {
        var cropX = options.cropX?parseFloat(options.cropX):0;
        var cropY = options.cropY?parseFloat(options.cropY):0;
        var width = dimensions.width?(parseFloat(dimensions.width) + parseFloat(cropX)):0;
        var height = dimensions.height?(parseFloat(dimensions.height) + parseFloat(cropY)):0;
        var originalWidth = parseFloat(imageInfo.width);
        var originalHeight = parseFloat(imageInfo.height);
        if (width <= (originalWidth-cropX) && height <= (originalHeight-cropY)) {
          if (width==0) width = originalWidth-cropX;
          if (height==0) height = originalHeight-cropY;
          convertedStream.extract(cropX, cropY, width, height);
        }
        else {
          var err = {
            statusCode: 400,
            message: 'Crop size is greater than image size.'
          }

          return reject(err);
        }
      }
      convertedStream = convertedStream.pipe(magickVar);
    } else {
      convertedStream = readStream.pipe(magickVar);
    }

    // duplicate stream for caching
    var cacheStream = PassThrough()
    convertedStream.pipe(cacheStream)
    // duplicate stream for returning
    var returnStream = PassThrough()
    convertedStream.pipe(returnStream)

    return resolve(returnStream)

    self.cache.cacheImage(cacheStream, encryptName, function() {
      if (self.options.format === 'json') {
        self.fetchImageInformation(returnStream, self.fileName, self.cacheKey, displayOption, res);
      } else {
        var buffers = [];
        var fileSize = 0;

        function lengthListener(length) {
          fileSize = length;
        }

        if (config.get('gzip')) {
          res.setHeader('content-encoding', 'gzip');
          var gzipStream = returnStream.pipe(zlib.createGzip());
          gzipStream = gzipStream.pipe(lengthStream(lengthListener));
          gzipStream.on('data', function (buffer) {
            buffers.push(buffer);
          });
          gzipStream.on('end', function () {
            var buffer = Buffer.concat(buffers);
            res.setHeader('Content-Length', fileSize);
            res.end(buffer);
          });
        } else {
          convertedStream = returnStream.pipe(lengthStream(lengthListener));
          convertedStream.on('data', function (buffer) {
            buffers.push(buffer);
          });
          convertedStream.on('end', function () {
            var buffer = Buffer.concat(buffers);
            res.setHeader('Content-Length', fileSize);
            res.end(buffer);
          });
        }
      }
    })
  })
}

function getDimensions(options) {
  var dimensions = {
    width: 0,
    height: 0
  }

  if (options.ratio) {
    var ratio = options.ratio.split('-');
    if (!options.width && parseFloat(options.height) > 0) {
      dimensions.width = parseFloat(options.height) * (parseFloat(ratio[0]) / parseFloat(ratio[1]));
      dimensions.height = parseFloat(options.height);
    }
    else if (!options.height && parseFloat(options.width) > 0) {
      dimensions.height = parseFloat(options.width) * (parseFloat(ratio[1]) / parseFloat(ratio[0]));
      dimensions.width = parseFloat(options.width);
    }
  }

  if (options.devicePixelRatio && options.devicePixelRatio < 4) {
    // http://devicepixelratio.com/
    dimensions.width = parseFloat(dimensions.width) * parseFloat(options.devicePixelRatio);
    dimensions.height = parseFloat(dimensions.height) * parseFloat(options.devicePixelRatio);
  }

  if (config.get('security.maxWidth') && config.get('security.maxWidth') < dimensions.width)
    dimensions.width = config.get('security.maxWidth');
  if (config.get('security.maxHeight') && config.get('security.maxHeight') < dimensions.height)
    dimensions.height = config.get('security.maxHeight');

  return dimensions;
}

/**
 * Parses the request URL and returns an options object
 * @param {Array} optionsArray - the options specified in the request URL
 * @returns {object}
 */
function getImageOptions (optionsArray) {

  var gravity = optionsArray[11].substring(0, 1).toUpperCase() + optionsArray[11].substring(1);
  var filter = optionsArray[12].substring(0, 1).toUpperCase() + optionsArray[12].substring(1);

  options = {
    format: optionsArray[0],
    quality: optionsArray[1],
    trim: optionsArray[2],
    trimFuzz: optionsArray[3],
    width: optionsArray[4],
    height: optionsArray[5],
    cropX: optionsArray[6],
    cropY: optionsArray[7],
    ratio: optionsArray[8],
    devicePixelRatio: optionsArray[9],
    resizeStyle: optionsArray[10],
    gravity: gravity,
    filter: filter,
    blur: optionsArray[13],
    strip: optionsArray[14],
    rotate: optionsArray[15],
    flip: optionsArray[16]
  }

  return options;
}

module.exports = function (format, req) {
  return new ImageHandler(format, req);
}

module.exports.ImageHandler = ImageHandler;
