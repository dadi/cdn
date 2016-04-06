var fs = require('fs');
var path = require('path');
var ColorThief = require('color-thief'),
  colorThief = new ColorThief();
var imagemagick = require('imagemagick-native');
var lengthStream = require('length-stream');
var request = require('request');
var sha1 = require('sha1');
var sharp = require('sharp');
var zlib = require('zlib');
var imagesize = require('imagesize');

var StorageFactory = require(__dirname + '/storage/factory');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');

var ImageHandle = function(s3, cache) {
  this.s3 = s3;
  this.cache = cache;
  this.factory = Object.create(StorageFactory);
};

/**
 * Convert image and store in local disk or Redis.
 * readStream: read stream from S3, local disk and url
 * fileName: file name to store converted image data
 * options: convert options
 */
ImageHandle.prototype.convertAndSave = function (readStream, imageInfo, originFileName, fileName, options, returnJSON, res) {
  var self = this;
  var encryptName = sha1(fileName);
  var displayOption = options;

  if(options.ratio) {
    var ratio = options.ratio.split('-');
    if(!options.width && parseFloat(options.height) > 0) {
      options.width = parseFloat(options.height) * (parseFloat(ratio[0]) / parseFloat(ratio[1]));
    } else if(!options.height && parseFloat(options.width) > 0) {
      options.height = parseFloat(options.width) * (parseFloat(ratio[1]) / parseFloat(ratio[0]));
    }
  }
  if(options.devicePixelRatio) {
    options.width = parseFloat(options.width) * parseFloat(options.devicePixelRatio);
    options.height = parseFloat(options.height) * parseFloat(options.devicePixelRatio);
  }

  var magickVar = imagemagick.streams.convert(options);
  magickVar.on('error', function (error) {
    help.displayErrorPage(404, error, res);
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
      var width = options.width?(parseFloat(options.width) + parseFloat(cropX)):0;
      var height = options.height?(parseFloat(options.height) + parseFloat(cropY)):0;
      var originalWidth = parseFloat(imageInfo.width);
      var originalHeight = parseFloat(imageInfo.height);
      if(width <= (originalWidth-cropX) && height <= (originalHeight-cropY)) {
        if(width==0) width = originalWidth-cropX;
        if(height==0) height = originalHeight-cropY;
        convertedStream.extract(cropX, cropY, width, height);
      } else {
        help.displayErrorPage(404, 'Crop size is greater than image size.', res);
        return;
      }
    }
    convertedStream = convertedStream.pipe(magickVar);
  } else {
    convertedStream = readStream.pipe(magickVar);
  }

  self.cache.cacheImage(convertedStream, encryptName, function() {
    if (returnJSON) {
      self.fetchImageInformation(convertedStream, originFileName, fileName, displayOption, res);
    } else {
      var buffers = [];
      var fileSize = 0;

      function lengthListener(length) {
        fileSize = length;
      }
      if(config.get('gzip')) {
        res.setHeader('content-encoding', 'gzip');
        var gzipStream = convertedStream.pipe(zlib.createGzip());
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
        convertedStream = convertedStream.pipe(lengthStream(lengthListener));
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
  });
};

/**
 * Convert new image
 */
ImageHandle.prototype.createNewConvertImage = function (req, originFileName, newFileName, options, returnJSON, res) {
  var self = this;

  var storage = self.factory.create(req);

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
      console.log(imageInfo)
      self.convertAndSave(responseStream, imageInfo, originFileName, newFileName, options, returnJSON, res);
    });

  }).catch(function(error) {
    console.log('error')
    console.log(error)
  });

  // if (url.length > 0) {
  //   if (config.get('images.remote.enabled')) { // Load image from http or https url
  //     url = config.get('images.remote.path') + '/' + url;
  //     request({url: url}, function (error, response, body) {
  //       if (!error && response.statusCode == 200) {
  //         var size = parseInt(response.headers['content-length']);
  //         if(size === 0) {
  //           return help.displayErrorPage(404, 'File size is 0 byte.', res);
  //         }
  //         var tmpReadStream = request({url: url});
  //         imagesize(tmpReadStream, function(err, imageInfo) {
  //           self.convertAndSave(request({url: url}), imageInfo, originFileName, newFileName, options, returnJSON, res);
  //         });
  //       }
  //       else {
  //         help.displayErrorPage(404, 'Image path "' + url + '" isn\'t valid.', res);
  //       }
  //     });
  //   }
  //   else if (config.get('images.s3.enabled')) { //Load image from S3
  //     if(url.substring(0, 1) == '/') url = url.substring(1);
  //     self.s3.getObject({Bucket: config.get('images.s3.bucketName'), Key: url}, function (err, data) {
  //       if (err) {
  //         help.displayErrorPage(404, err, res);
  //       }
  //       else {
  //         var size = parseInt(data.ContentLength);
  //         if(size === 0) {
  //           return help.displayErrorPage(404, 'File size is 0 byte.', res);
  //         }
  //         var s3ReadStream = self.s3.getObject({
  //           Bucket: config.get('images.s3.bucketName'),
  //           Key: url
  //         }).createReadStream();
  //         var tmpReadStream = self.s3.getObject({
  //           Bucket: config.get('images.s3.bucketName'),
  //           Key: url
  //         }).createReadStream();
  //         imagesize(tmpReadStream, function(err, imageInfo) {
  //           self.convertAndSave(s3ReadStream, imageInfo, originFileName, newFileName, options, returnJSON, res);
  //         });
  //       }
  //     });
  //   }
  //   else { // Load image from local disk
  //     var imageDir = path.resolve(config.get('images.directory.path'));
  //     url = path.join(imageDir, url);
  //     if (fs.existsSync(url)) {
  //       var fsReadStream = fs.createReadStream(url);
  //       var stats = fs.statSync(url);
  //       var fileSize = parseInt(stats["size"]);
  //       if(fileSize === 0) {
  //         return help.displayErrorPage(404, 'File size is 0 byte.', res);
  //       }
  //       var tmpReadStream = fs.createReadStream(url);
  //       imagesize(tmpReadStream, function(err, imageInfo) {
  //         self.convertAndSave(fsReadStream, imageInfo, originFileName, newFileName, options, returnJSON, res);
  //       });
  //     }
  //     else {
  //       help.displayErrorPage(404, 'File "' + url + '" doesn\'t exist.', res);
  //     }
  //   }
  // }
  // else {
  //   help.displayErrorPage(404, 'Image path doesn\'t exist.', res);
  // }
};

/**
 * Get image information from image buffer.
 * readStream: read stream from S3, local disk and url
 * fileName: file name to store converted image data
 */
ImageHandle.prototype.fetchImageInformation = function (readStream, originFileName, fileName, options, res) {
  var buffers = [];
  var fileSize = 0;
  var encryptName = sha1(fileName);

  function lengthListener(length) {
    fileSize = length;
  }

  readStream = readStream.pipe(lengthStream(lengthListener));
  readStream.on('data', function (buffer) {
    buffers.push(buffer);
  });
  readStream.on('end', function () {
    var buffer = Buffer.concat(buffers);
    var primaryColor = RGBtoHex(colorThief.getColor(buffer)[0], colorThief.getColor(buffer)[1], colorThief.getColor(buffer)[2]);
    imagemagick.identify({
      srcData: buffer
    }, function (err, result) {
      var jsonData = {
        fileName: originFileName,
        cacheReference: encryptName,
        fileSize: fileSize,
        format: result.format,
        width: result.width,
        height: result.height,
        depth: result.depth,
        density: result.density,
        exif: result.exif,
        primaryColor: primaryColor,
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
      };
      help.sendBackJSON(200, jsonData, res);

    });
  });
};

// exports
module.exports = function (s3, cache) {
  return new ImageHandle(s3, cache);
};

module.exports.ImageHandle = ImageHandle;

function RGBtoHex(red, green, blue) {
  return '#' + ('00000' + (red << 16 | green << 8 | blue).toString(16)).slice(-6);
}
