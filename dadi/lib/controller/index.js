var lengthStream = require('length-stream');
var sha1 = require('sha1');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');
var cloudfront = require('cloudfront');
var redis = require('redis');
var nodeUrl = require('url');
var _ = require('underscore');

var configPath = path.resolve(__dirname + '/../../../config');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var monitor = require(__dirname + '/../monitor');
var HandlerFactory = require(__dirname + '/../handlers/factory');

var Controller = function (router) {
  var self = this;
  this.monitors = {};

  //Monitor config.json file
  self.addMonitor(configPath, function (filename) {
    delete require.cache[configPath];
    config = require(configPath);
  });

  //Monitor recipes folders and files
  var recipeDir = path.resolve(__dirname + '/../../../workspace/recipes');
  self.addMonitor(recipeDir, function (filename) {
    delete require.cache[recipeDir + '/' + filename];
  });

  router.get(/(.+)/, function (req, res) {
    var factory = new HandlerFactory();
console.log(factory)
    factory.create(req, function(handler) {

    console.log('handler')
    console.log(handler)

    // TODO: check cache inside GET(), returning stream
    handler.get().then(function(stream) {

      console.log('CONTROLLER')
console.log(stream)
      if (handler.format === 'js') {
        res.setHeader('Content-Type', 'application/javascript');
      }
      else if (handler.format === 'css') {
        res.setHeader('Content-Type', 'text/css');
      }

      if (handler.cached) {
        res.setHeader('X-Cache', 'HIT');
      }
      else {
        res.setHeader('X-Cache', 'MISS');
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
console.log(err.stack)
      help.displayErrorPage(err.statusCode, err.message, res);
    });
  })

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

Controller.prototype.addMonitor = function (filepath, callback) {
  filepath = path.normalize(filepath);
  if (this.monitors[filepath]) return;
  var m = monitor(filepath);
  m.on('change', callback);
  this.monitors[filepath] = m;
}

module.exports = function (model) {
  return new Controller(model);
}
