var fs = require('fs');
var ColorThief = require('color-thief');
var colorThief = new ColorThief();
var imagemagick = require('imagemagick-native');
var imagesize = require('imagesize');
var lengthStream = require('length-stream');
var PassThrough = require('stream').PassThrough;
var path = require('path');
var Promise = require('bluebird');
var Readable = require('stream').Readable;
var request = require('request');
var sha1 = require('sha1');
var sharp = require('sharp');
var url = require('url');
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

  if (parsedUrl.search) {
    this.options = parsedUrl.query;
    if (typeof this.options.format === 'undefined') this.options.format = this.fileExt;
  }
  else {
    var optionsArray = _.compact(parsedUrl.pathname.split('/')).slice(0, 17);
    //url = paramString.substring(optionsArray.join('/').length + 1);
    // fileName = url.split('/')[url.split('/').length - 1];
    // fileExt = url.substring(url.lastIndexOf('.') + 1);
    this.options = getImageOptions(optionsArray);
  }

  if (this.options.format === 'json') {
    if (this.fileExt === this.fileName) {
      this.format = 'PNG';
    }
    else {
      this.format = this.fileExt;
    }
  }
  else {
    this.format = this.options.format;
  }
}

ImageHandler.prototype.get = function () {
  var self = this;
  self.cached = false;

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

    // get from cache
    self.cache.get(self.cacheKey, function (stream) {
      if (stream) {
        self.cached = true;
        // if (returnJSON) {
        //   imageHandler.fetchImageInformation(readStream, originFileName, modelName, options, res);
        // } else {
        return resolve(stream)
      }

      // not in cache, so get image from source
      var storage = self.factory.create('image', self.req);

      storage.get().then(function(stream) {
        var cacheStream = new PassThrough()
        var convertStream = PassThrough()
        var imageSizeStream = PassThrough()
        var responseStream = new PassThrough()

        // duplicate the stream so we can use it for the imagesize() request and the
        // response. this saves requesting the same data a second time.
        stream.pipe(imageSizeStream)
        stream.pipe(convertStream)

console.log(self.options)

        imagesize(imageSizeStream, function(err, imageInfo) {
          // originFileName = 01.jpg
          // modelName = full URL pathname = /jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/cdn-media/01.jpg
console.log(imageInfo)
          self.convert(convertStream, imageInfo).then(function(stream) {
console.log('stream from convert')
console.log(stream)
// stream.pipe(cacheStream)
//console.log('cache stream')
//console.log(cacheStream)
stream.pipe(responseStream)
console.log('response stream')
console.log(responseStream)
            self.cache.cacheFile(stream, self.cacheKey, function () {
console.log('back from cache')
              // return image info only, as json
              if (self.options.format === 'json') {
                self.getImageInfo(responseStream, function(data) {
                  var returnStream = new Readable()
                  returnStream.push(JSON.stringify(data,null,2))
                  returnStream.push(null)
                  return resolve(returnStream)
                })
              }
              else {
                // return image
                return resolve(responseStream)
              }
            })
          }).catch(function(err) {
            return reject(err);
          })
        })
      }).catch(function(err) {
        return reject(err);
      })
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
      stream = stream.pipe(imagemagick.streams.convert({format: options.format}));
    }

    var convertedStream = null;
    if (sharpStream != null) {
      convertedStream = stream.pipe(sharpStream);
      if (options.cropX && options.cropY) {
        var cropX = options.cropX?parseFloat(options.cropX):0;
        var cropY = options.cropY?parseFloat(options.cropY):0;
        var width = dimensions.width?(parseFloat(dimensions.width) + parseFloat(cropX)):0;
        var height = dimensions.height?(parseFloat(dimensions.height) + parseFloat(cropY)):0;
        var originalWidth = parseFloat(imageInfo.width);
        var originalHeight = parseFloat(imageInfo.height);
        if (width <= (originalWidth-cropX) && height <= (originalHeight-cropY)) {
          if (width==0) width = originalWidth-cropX;
          if (height==0) height = originalHeight-cropY;
          try {
            convertedStream.extract(cropX, cropY, width, height);
          }
          catch (err) {
            return reject(err);
          }
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
    }
    else {
      convertedStream = stream.pipe(magickVar);
    }

    // duplicate stream for caching
    // var cacheStream = PassThrough()
    // convertedStream.pipe(cacheStream)
    // duplicate stream for returning
//    var returnStream = PassThrough()
//    convertedStream.pipe(returnStream)

    return resolve(convertedStream)
  })
}

/**
 * Get image information from stream
 * @param {stream} stream - read stream from S3, local disk or url
 * @returns {object}
 */

/*
{ "fileName":"322324f3696ec76c3479617aa2d700403e58b74c.jpg", "cacheReference":"24a33b40b0c2281cb045d6dff9139a5a0ec0baff",
  "fileSize":20766, "format":"JPEG", "width":"520", "height":"346", "depth":8,
  "density":{"width":72,"height":72}, "exif":{"orientation":0}, "primaryColor":"#b7b7b0",
  "quality":"70", "trim":0, "trimFuzz":0, "resizeStyle":"aspectfill", "gravity":"Center",
  "filter":"None", "blur":0, "strip":0, "rotate":0, "flip":0, "ratio":0, "devicePixelRatio":0
}
*/
ImageHandler.prototype.getImageInfo = function (stream, cb) {
  var self = this;
  var buffers = [];
  var fileSize = 0;

  function lengthListener(length) {
console.log(length)
    fileSize = length;
  }

var options = self.options;

var ls = lengthStream(lengthListener);
stream
    .pipe(ls)
    .on('error', function (err) { console.log(err); })
    .on('data', function (data) { buffers.push(data); })
    .on('end', function () {
      console.log('DONE');
    });
stream.end();
  var data = {
    fileName: self.fileName,
    cacheReference: sha1(self.fileName),
    quality: options.quality ? options.quality : 75,
    trim: options.trim ? options.trim : 0,
    trimFuzz: options.trimFuzz ? options.trimFuzz : 0,
    resizeStyle: options.resizeStyle ? options.resizeStyle : 'aspectfill',
    gravity: options.gravity ? options.gravity : 'Center',
    filter: options.filter ? options.filter : 'None',
    blur: options.blur ? options.blur : 0,
    strip: options.strip ? options.strip : 0,
    rotate: options.rotate ? options.rotate : 0,
    flip: options.flip ? options.flip : 0,
    ratio: options.ratio ? options.ratio : 0,
    devicePixelRatio: options.devicePixelRatio ? options.devicePixelRatio : 0
  }

  console.log(data)

//  stream.on('end', function () {
//    var buffer = Buffer.concat(buffers);
//    var primaryColor = RGBtoHex(colorThief.getColor(buffer)[0], colorThief.getColor(buffer)[1], colorThief.getColor(buffer)[2]);
//    imagemagick.identify({
 //     srcData: buffer
 //   }, function (err, result) {

//        fileSize: fileSize,
//        format: result.format,
//        width: result.width,
//        height: result.height,
//        depth: result.depth,
//        density: result.density,
//        exif: result.exif,
//        primaryColor: primaryColor,
//console.log(result)
//      cb(data);
//    })

//  })
  return cb(data)
}

/**
 *
 */
function RGBtoHex(red, green, blue) {
  return '#' + ('00000' + (red << 16 | green << 8 | blue).toString(16)).slice(-6);
}

function getDimensions(options) {
  var dimensions = {
    width: options.width,
    height: options.height
  }

  if (options.ratio) {
    var ratio = options.ratio.split('-');
    if (!dimensions.width && parseFloat(dimensions.height) > 0) {
      dimensions.width = parseFloat(dimensions.height) * (parseFloat(ratio[0]) / parseFloat(ratio[1]));
      dimensions.height = parseFloat(dimensions.height);
    }
    else if (!dimensions.height && parseFloat(dimensions.width) > 0) {
      dimensions.height = parseFloat(dimensions.width) * (parseFloat(ratio[1]) / parseFloat(ratio[0]));
      dimensions.width = parseFloat(dimensions.width);
    }
  }

  if (config.get('security.maxWidth') && config.get('security.maxWidth') < dimensions.width)
    dimensions.width = config.get('security.maxWidth');
  if (config.get('security.maxHeight') && config.get('security.maxHeight') < dimensions.height)
    dimensions.height = config.get('security.maxHeight');

  if (options.devicePixelRatio && options.devicePixelRatio < 4) {
    // http://devicepixelratio.com/
    dimensions.width = parseFloat(dimensions.width) * parseFloat(options.devicePixelRatio);
    dimensions.height = parseFloat(dimensions.height) * parseFloat(options.devicePixelRatio);
  }

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

  if (options.filter == 'None' || options.filter == 0) delete options.filter;
  if (options.gravity == 0) delete options.gravity;
  if (options.width == 0) delete options.width;
  if (options.height == 0) delete options.height;
  if (options.quality == 0) delete options.quality;
  if (options.trim == 0) delete options.trim;
  if (options.trimFuzz == 0) delete options.trimFuzz;
  if (options.cropX == 0) delete options.cropX;
  if (options.cropY == 0) delete options.cropY;
  if (options.ratio == 0) delete options.ratio;
  if (options.devicePixelRatio == 0) delete options.devicePixelRatio;
  if (options.resizeStyle == 0) delete options.resizeStyle;
  if (options.blur == 0) delete options.blur;
  if (options.strip == 0) delete options.strip;
  if (options.rotate == 0) delete options.rotate;
  if (options.flip == 0) delete options.flip;

  return options;
}

module.exports = function (format, req) {
  return new ImageHandler(format, req);
}

module.exports.ImageHandler = ImageHandler;
