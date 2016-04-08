var lengthStream = require('length-stream');
var redisRStream = require('redis-rstream');
var sha1 = require('sha1');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');
var cloudfront = require('cloudfront');
var redis = require('redis');
var nodeUrl = require('url');
var _ = require('underscore');

var configPath = path.resolve(__dirname + '/../../../config');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var monitor = require(__dirname + '/../monitor');
var HandlerFactory = require(__dirname + '/../handlers/factory');
// var ImageHandle = require(__dirname + '/../imagehandle');
// var AssetHandle = require(__dirname + '/../assethandle');
//var cache = require(__dirname + '/../cache');

var Controller = function (router) {
  var self = this;
//  this.s3 = null;
  //this.assetsS3 = null;
  //this.client = null;
  this.monitors = {};

  //Monitor config.json file
  self.addMonitor(configPath, function (filename) {
    delete require.cache[configPath];
    config = require(configPath);

    //Init S3 Instance
  //  if (config.get('images.s3.enabled')) {
  //    self.initS3Bucket();
  //  }
    // if (config.get('assets.s3.enabled')) {
    //   self.initS3AssetsBucket();
    // }
    // //Init Redis client
    // if (config.get('caching.redis.enabled')) {
    //   self.initRedisClient();
    // }
  });

  //Monitor recipes folders and files
  var recipeDir = path.resolve(__dirname + '/../../../workspace/recipes');
  self.addMonitor(recipeDir, function (filename) {
    delete require.cache[recipeDir + '/' + filename];
  });

  //Init S3 Instance
  //if (config.get('images.s3.enabled')) {
  //  self.initS3Bucket();
  //}
  // if (config.get('assets.s3.enabled')) {
  //   self.initS3AssetsBucket();
  // }
  //Init Redis client
  // if (config.get('caching.redis.enabled')) {
  //   self.initRedisClient();
  // }

  //this.cache = cache();

  //var imageHandler = ImageHandle(this.s3, this.cache);
  //var assetHandler = AssetHandle(this.assetsS3, this.cache);

  router.get(/(.+)/, function (req, res) {
    //var requestParams = req.params[0].substring(1, req.params[0].length);
    //var paramString = req.params[0].substring(1, req.params[0].length);
    // var modelName = req.params[0];
    // var encryptName = sha1(modelName);

    // set a default version
    //var version = 'v1'

    // set version 2 if the url was supplied with a querystring
    // if (require('url').parse(req.url, true).search) {
    //   version = 'v2'
    // }

    // var returnJSON = false;
    // var fileExt = '';
    // var compress = '';
    // var url = '';
    // var fileName = '';
    // var error = '';
    // var newFileName = '';
    // var supportExts = ['ttf', 'otf', 'woff', 'svg', 'eot'];
    // var options = {};

    var factory = Object.create(HandlerFactory);
    var handler = factory.create(req);

//    console.log(handler)

    // TODO: check cache inside GET(), returning stream
    handler.get().then(function(stream) {

      console.log('CONTROLLER')
//console.log(stream)

      if (handler.format === 'js') {
        res.setHeader('Content-Type', 'application/javascript');
      }
      else if (handler.format === 'css') {
        res.setHeader('Content-Type', 'text/css');
      }

      var buffers = [];
      var fileSize = 0;

      function lengthListener(length) {
        fileSize = length;
      }

      if (config.get('gzip')) {
        res.setHeader('content-encoding', 'gzip');
        var gzipStream = stream.pipe(zlib.createGzip());
        gzipStream = gzipStream.pipe(lengthStream(lengthListener));

        gzipStream.on('data', function (buffer) {
          buffers.push(buffer);
        });

        gzipStream.on('end', function () {
          var buffer = Buffer.concat(buffers);
          res.setHeader('Content-Length', fileSize);
          res.end(buffer);
        });
      }
      else {
        var convertedStream = stream.pipe(lengthStream(lengthListener));
        convertedStream.on('data', function (buffer) {
          buffers.push(buffer);
        });

        convertedStream.on('end', function () {
          var buffer = Buffer.concat(buffers);
          res.setHeader('Content-Length', fileSize);
          res.end(buffer);
        });
      }
    }).catch(function(err) {
      console.log('CONTROLLER')
      console.log(err)
      help.displayErrorPage(err.statusCode, err.message, res);
    });

    return;
    // if (1==2) {
    // }
    // else {
//console.log(version)
//console.log(paramString.split('/').length)
      // if (version === 'v1' && paramString.split('/').length < 15 &&
      //   !fs.existsSync(path.resolve(__dirname + '/../../../workspace/recipes/' + paramString.split('/')[0] + '.json'))) {
        // var errorMessage = '<p>Url path is invalid.</p>' +
        //   '<p>The valid url path format:</p>' +
        //   '<p>http://some-example-domain.com/{format}/{quality}/{trim}/{trimFuzz}/{width}/{height}/{crop-x}/{crop-y}/{ratio}/{devicePixelRatio}/{resizeStyle}/{gravity}/{filter}/{blur}/{strip}/{rotate}/{flip}/Imagepath</p>';
        // help.displayErrorPage(404, errorMessage, res);
      // }
      // else {
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
        // }
        // else {

          // if (version === 'v2') {
          //   var urlOptions = require('url').parse(req.url, true);
          //   url = urlOptions.pathname;
          //   fileName = urlOptions.pathname.substring(1);
          //   fileExt = path.extname(fileName).substring(1);
          //   options = urlOptions.query;
          //   if (typeof options.format === 'undefined') options.format = fileExt;
          // }
          // else {
          //   var optionsArray = paramString.split('/').slice(0, 17);
          //   url = paramString.substring(optionsArray.join('/').length + 1);
          //   fileName = url.split('/')[url.split('/').length - 1];
          //   fileExt = url.substring(url.lastIndexOf('.') + 1);
          //   options = getImageOptions(optionsArray, version);
          // }
        //}

        // if(options.format != 'assets') {
        //   if (options.format == 'json') {
        //     returnJSON = true;
        //     if (fileExt == fileName) {
        //       options.format = 'PNG';
        //     } else {
        //       options.format = fileExt;
        //     }
        //   }
        //
        //   var originFileName = fileName;

          // TODO: add to image handler
          // if (options.filter == 'None' || options.filter == 0) delete options.filter;
          // if (options.gravity == 0) delete options.gravity;
          // if (options.width == 0) delete options.width;
          // if (options.height == 0) delete options.height;
          // if (options.quality == 0) delete options.quality;
          // if (options.trim == 0) delete options.trim;
          // if (options.trimFuzz == 0) delete options.trimFuzz;
          // if (options.cropX == 0) delete options.cropX;
          // if (options.cropY == 0) delete options.cropY;
          // if (options.ratio == 0) delete options.ratio;
          // if (options.devicePixelRatio == 0) delete options.devicePixelRatio;
          // if (options.resizeStyle == 0) delete options.resizeStyle;
          // if (options.blur == 0) delete options.blur;
          // if (options.strip == 0) delete options.strip;
          // if (options.rotate == 0) delete options.rotate;
          // if (options.flip == 0) delete options.flip;

          // TODO: add to image handler
          // if (config.get('caching.redis.enabled')) {
          //   self.cache.client().exists(encryptName, function (err, exists) {
          //     if (exists > 0) {
          //       var readStream = redisRStream(self.cache.client(), encryptName);
          //       if (returnJSON) {
          //         imageHandler.fetchImageInformation(readStream, originFileName, modelName, options, res);
          //       } else {
          //         // Set cache header
          //         send using res pattern
          //       }
          //     } else {
          //       // Set cache header
          //       res.setHeader('X-Cache', 'MISS');
          //       imageHandler.createNewConvertImage(req, originFileName, modelName, options, returnJSON, res);
          //     }
          //   });
          // }
        //   else {
        //     var cacheDir = path.resolve(config.get('caching.directory.path'));
        //     var cachePath = path.join(cacheDir, encryptName);
        //     if (fs.existsSync(cachePath)) {
        //       fs.stat(cachePath, function (err, stats) {
        //         var lastMod = stats && stats.mtime && stats.mtime.valueOf();
        //         if (config.get('caching.ttl') && lastMod && (Date.now() - lastMod) / 1000 <= config.get('caching.ttl')) {
        //           var readStream = fs.createReadStream(cachePath);
        //           if (returnJSON) {
        //             imageHandler.fetchImageInformation(readStream, originFileName, modelName, options, res);
        //           } else {
        //             // Set cache header
        //             send using res pattern
        //           }
        //         }
        //         else {
        //           // Set cache header
        //           res.setHeader('X-Cache', 'MISS');
        //           imageHandler.createNewConvertImage(req, originFileName, modelName, options, returnJSON, res);
        //         }
        //       });
        //     }
        //     else {
        //       // Set cache header
        //       res.setHeader('X-Cache', 'MISS');
        //       imageHandler.createNewConvertImage(req, originFileName, modelName, options, returnJSON, res);
        //     }
        //   }
        // }
    //   }
    // }
  })

  //Invalidation request
  router.post('/api', function (req, res) {
    if (req.body.invalidate) {
      var invalidate = '';
      if(req.body.invalidate && req.body.invalidate !== '*')
        invalidate = sha1(req.body.invalidate);

      help.clearCache(invalidate, function(err) {
        if (config.get('cloudfront.enabled')) {
          var cf = cloudfront.createClient(config.get('cloudfront.accessKey'), config.get('cloudfront.secretKey'));
          cf.getDistribution(config.get('cloudfront.distribution'), function (err, distribution) {
            var callerReference = (new Date()).toString();
            distribution.invalidate(callerReference, ['/' + req.body.invalidate], function (err, invalidation) {
              if (err) console.log(err);

              help.sendBackJSON(200, {
                result: 'success',
                message: 'Succeed to clear'
              }, res);
            });
          });
        } else {
          help.sendBackJSON(200, {
            result: 'success',
            message: 'Succeed to clear'
          }, res);
        }
      });
    } else {
      help.sendBackJSON(400, {
        result: 'Failed',
        message: 'Please pass \'invalidate\' path'
      }, res);
    }
  });
};

/**
 * Init S3 with configuration
 */
Controller.prototype.initS3Bucket = function () {
  // AWS.config.update({
  //   accessKeyId: config.get('images.s3.accessKey'),
  //   secretAccessKey: config.get('images.s3.secretKey')
  // });
  // if(config.get('images.s3.region') && config.get('images.s3.region') != "") {
  //   AWS.config.update({
  //     region: config.get('images.s3.region')
  //   });
  // }
  //
  // this.s3 = new AWS.S3();
};

Controller.prototype.initS3AssetsBucket = function () {
  // AWS.config.update({
  //   accessKeyId: config.get('assets.s3.accessKey'),
  //   secretAccessKey: config.get('assets.s3.secretKey')
  // });
  // if(config.get('images.s3.region') && config.get('images.s3.region') != "") {
  //   AWS.config.update({
  //     region: config.get('images.s3.region')
  //   });
  // }
  //
  // this.assetsS3 = new AWS.S3();
};

Controller.prototype.addMonitor = function (filepath, callback) {
  filepath = path.normalize(filepath);
  if (this.monitors[filepath]) return;
  var m = monitor(filepath);
  m.on('change', callback);
  this.monitors[filepath] = m;
};

module.exports = function (model) {
  return new Controller(model);
};
