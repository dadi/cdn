var fs = require('fs');
var concat = require('concat-stream')
var ColorThief = require('color-thief');
var colorThief = new ColorThief();
var ExifImage = require('exif').ExifImage;
var fill = require("aspect-fill")
var fit = require("aspect-fit");
var imagesize = require('imagesize');
var lengthStream = require('length-stream');
var PassThrough = require('stream').PassThrough;
var path = require('path');
var Promise = require('bluebird');
var Readable = require('stream').Readable;
var sha1 = require('sha1');
var url = require('url');
var _ = require('underscore');

var StorageFactory = require(__dirname + '/../storage/factory');
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
  this.url = req.url;
  this.cacheKey = parsedUrl.pathname;
  this.fileName = path.basename(parsedUrl.pathname);
  this.fileExt = path.extname(this.fileName).substring(1);
  this.exifData = {}
}

ImageHandler.prototype.get = function () {
  var self = this;
  self.cached = false;

  var parsedUrl = url.parse(this.req.url, true);
  if (parsedUrl.search) {
    this.options = parsedUrl.query;
    if (typeof this.options.format === 'undefined') this.options.format = this.fileExt;
  }
  else if (!this.options) {
    var optionsArray = _.compact(parsedUrl.pathname.split('/')).slice(0, 17);
    //url = paramString.substring(optionsArray.join('/').length + 1);
    // fileName = url.split('/')[url.split('/').length - 1];
    // fileExt = url.substring(url.lastIndexOf('.') + 1);
    this.options = getImageOptions(optionsArray);
  }

  this.options = self.sanitiseOptions(this.options);

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

      // if found in cache, return it
      if (stream) {
        if (self.options.format !== 'json') {
          self.cached = true;
          return resolve(stream)
        }
      }

      // not in cache, get image from source
      var storage = self.factory.create('image', self.url);

      storage.get().then(function(stream) {
        var cacheStream = new PassThrough()
        var convertStream = new PassThrough()
        var imageSizeStream = new PassThrough()
        var responseStream = new PassThrough()
        var exifStream = new PassThrough()

        // duplicate the stream so we can use it for the imagesize() request and the
        // response. this saves requesting the same data a second time.
        stream.pipe(imageSizeStream)
        stream.pipe(convertStream)
        //stream.pipe(exifStream)

        // get the image size and format
        imagesize(imageSizeStream, function(err, imageInfo) {

          // extract exif data if available
          //if (imageInfo && /jpe?g/.exec(imageInfo.format)) {
          //  self.extractExifData(exifStream).then(function(exifData) {
          //    self.exifData = exifData
          //  })
          //}
          //else {
          //  exifStream = null
          //}

          // connvert image using specified options
          self.convert(convertStream, imageInfo).then(function(convertedStream) {

            convertedStream.pipe(cacheStream)
            convertedStream.pipe(responseStream)

            // cache the file if enabled
            self.cache.cacheFile(cacheStream, self.cacheKey, function() {
              // return image info only, as json
              if (self.options.format === 'json') {
                self.getImageInfo(convertedStream, imageInfo, function(data) {
                  var returnStream = new Readable()
                  returnStream.push(JSON.stringify(data, null, 2))
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

    var dimensions = getDimensions(options, imageInfo);
    var width = dimensions.width
    var height = dimensions.height

    // console.log(options)
    // console.log(dimensions)

    if (options.cropX && options.cropY) {
      options.cropX = options.cropX ? parseFloat(options.cropX) : 0;
      options.cropY = options.cropY ? parseFloat(options.cropY) : 0;
      width = width ? (parseFloat(width) + parseFloat(options.cropX)) : 0;
      height = height ? (parseFloat(height) + parseFloat(options.cropY)) : 0;
      var originalWidth = parseFloat(imageInfo.width);
      var originalHeight = parseFloat(imageInfo.height);

      // console.log({
      //   cropX: options.cropX,
      //   cropY: options.cropY,
      //   width: width,
      //   height: height
      // })

      if (width <= (originalWidth-options.cropX) && height <= (originalHeight-options.cropY)) {
        if (width === 0) width = originalWidth-options.cropX;
        if (height === 0) height = originalHeight-options.cropY;
      }
      else {
        var err = {
          statusCode: 400,
          message: 'Crop size is greater than image size.'
        }
        return reject(err);
      }
    }

    var concatStream = concat(processImage)
    stream.pipe(concatStream)

    function processImage(image) {

      // obtain an image object
      require('lwip').open(image, imageInfo.format, function(err, image){

        if (err) return reject(err)

        // define a batch of manipulations and save to disk as JPEG:
        var batch = image.batch()

        var filter = options.filter ? options.filter.toLowerCase() : 'lanczos'

        // resize
        if (width && height && options.resizeStyle) {
          if (options.resizeStyle === 'aspectfit') {
            var size = fit(imageInfo.width, imageInfo.height, width, height)
            batch.cover(Math.ceil(size.width), Math.ceil(size.height), filter)
          }
          else if (options.resizeStyle === 'aspectfill') {
            batch.cover(width, height, filter)
          }
          else {
            // fill
            batch.resize(width, height, filter)
          }
        }
        else if (width && height) {
          batch.cover(parseInt(width), parseInt(height))
        }
        else if (width && !height) {
          batch.resize(parseInt(width))
        }

        // crop
        //if (options.cropX && options.cropY) batch.crop(options.cropX, options.cropY)

        if (options.blur) batch.blur(parseInt(options.blur))
        if (options.flip) batch.flip(options.flip)
        if (options.rotate) batch.rotate(parseInt(options.rotate), 'white')

        // quality
        var params = {}
        var quality = parseInt(options.quality)
        if (/jpe?g/.exec(imageInfo.format)) params.quality = quality
        if (/png/.exec(imageInfo.format)) {
          if (quality > 70) params.compression = 'none'
          else if (quality > 50) params.compression = 'fast'
          else params.compression = 'high'
        }

        // sharpening
        if (quality >= 70) {
          if (/jpe?g/.exec(imageInfo.format)) {
            batch.sharpen(5)
          }
          else if (/png/.exec(imageInfo.format)) {
            batch.sharpen(5)
          }
        }
        else if (options.cropX && options.cropY) {
          batch.sharpen(5)
        }

        // format
        var format = self.options.format === 'json' ? imageInfo.format : self.options.format

        try {
          batch.exec(function(err, image) {
            image.toBuffer(format, params, function (err, buffer) {
              if (err) return reject(err)

              var bufferStream = new PassThrough();
              bufferStream.end(buffer)
              return resolve(bufferStream)
            })
          })
        }
        catch (err) {
          return reject(err);
        }
      })
    }

    //
    // if(imageInfo.format.toLowerCase() == 'gif') {
    //   stream = stream.pipe(imagemagick.streams.convert({format: options.format}));
    // }
  })
}

/**
 * Extract EXIF data from the specified image
 * @param {stream} stream - read stream from S3, local disk or url
 */
ImageHandler.prototype.extractExifData = function (stream) {
  var self = this;

  return new Promise(function(resolve, reject) {

    var image;
    var concatStream = concat(gotImage)
    stream.pipe(concatStream)

    function gotImage(buffer) {
      new ExifImage({ image : buffer }, function (err, data) {
        if (err)
          return reject(err)
        else
          return resolve(data)
      })
    }
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
ImageHandler.prototype.getImageInfo = function (stream, imageInfo, cb) {
  var self = this;
  var options = self.options;
  var buffers = [];
  var fileSize = 0;

  function lengthListener(length) {
    fileSize = length;
  }

  var data = {
    fileName: self.fileName,
    cacheReference: sha1(self.fileName),
    format: imageInfo.format,
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

  var ls = lengthStream(lengthListener);
  stream.pipe(ls)
    .on('error', function (err) { console.log(err); })
    .on('data', function (data) { buffers.push(data); })
    .on('end', function () {
      var buffer = Buffer.concat(buffers);
      var primaryColor = RGBtoHex(colorThief.getColor(buffer)[0], colorThief.getColor(buffer)[1], colorThief.getColor(buffer)[2]);

      data.fileSize = fileSize;
      data.primaryColor = primaryColor;

      //if (self.exifData.image && self.exifData.image.XResolution) {
      //  data.density = {
      //    width: self.exifData.image.XResolution,
      //    height: self.exifData.image.YResolution
      //  }
      //}

      return cb(data)
    })
}

/**
 *
 */
function RGBtoHex(red, green, blue) {
  return '#' + ('00000' + (red << 16 | green << 8 | blue).toString(16)).slice(-6);
}

function getDimensions(options, imageInfo) {
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
    else if (!dimensions.height && !dimensions.height) {
      dimensions.width = parseFloat(imageInfo.height) * (parseFloat(ratio[0]) / parseFloat(ratio[1]));
      dimensions.height = parseFloat(imageInfo.width) * (parseFloat(ratio[1]) / parseFloat(ratio[0]));
    }
  }
  else {
    dimensions.width = dimensions.width || imageInfo.width
    dimensions.height = dimensions.height || imageInfo.height
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

  return options;
}

ImageHandler.prototype.sanitiseOptions = function (options) {
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
