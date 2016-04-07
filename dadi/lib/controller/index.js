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
var ImageHandle = require(__dirname + '/../imagehandle');
var AssetHandle = require(__dirname + '/../assethandle');
var cache = require(__dirname + '/../cache');

var Controller = function (router) {
  var self = this;
//  this.s3 = null;
  this.assetsS3 = null;
  this.client = null;
  this.monitors = {};

  //Monitor config.json file
  self.addMonitor(configPath, function (filename) {
    delete require.cache[configPath];
    config = require(configPath);

    //Init S3 Instance
  //  if (config.get('images.s3.enabled')) {
  //    self.initS3Bucket();
  //  }
    if (config.get('assets.s3.enabled')) {
      self.initS3AssetsBucket();
    }
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
  if (config.get('assets.s3.enabled')) {
    self.initS3AssetsBucket();
  }
  //Init Redis client
  // if (config.get('caching.redis.enabled')) {
  //   self.initRedisClient();
  // }

  this.cache = cache();

  var imageHandler = ImageHandle(this.s3, this.cache);
  var assetHandler = AssetHandle(this.assetsS3, this.cache);

  function parseUrl(req) {
    return nodeUrl.parse(req.url, true);
  }

  function getFormat(version, url) {
    if (version === 'v1') {
      return _.compact(url.pathname.split('/'))[0];
    } else if (version === 'v2') {
      return url.query.format;
    }
  }

  router.get(/(.+)/, function (req, res) {
    //var requestParams = req.params[0].substring(1, req.params[0].length);
    var paramString = req.params[0].substring(1, req.params[0].length);
    var modelName = req.params[0];
    var encryptName = sha1(modelName);

    // set a default version
    var version = 'v1'

    // set version 2 if the url was supplied with a querystring
    if (require('url').parse(req.url, true).search) {
      version = 'v2'
    }

    var returnJSON = false;
    var fileExt = '';
    var compress = '';
    var url = '';
    var fileName = '';
    var error = '';
    var newFileName = '';
    var supportExts = ['ttf', 'otf', 'woff', 'svg', 'eot'];
    var options = {};

    var parsedUrl = parseUrl(req);
    var format = getFormat(version, parsedUrl);
    var factory = Object.create(HandlerFactory);
    var handler = factory.create(format, parsedUrl);

    handler.get().then(function() {

    }).catch(function(err) {
      console.log(err)
      help.displayErrorPage(err.statusCode, err.message, res);
    });

    if (paramString.split('/')[0] == 'js' || paramString.split('/')[0] == 'css') {
      fileExt = paramString.split('/')[0];
      compress = paramString.split('/')[1];
      url = paramString.substring(paramString.split('/')[0].length + 3);
      fileName = url.split('/')[url.split('/').length - 1];
      if(fileName.split('.').length == 1) fileName = fileName + '.' + fileExt;

      if (compress != 0 && compress != 1) {
        error = '<p>Url path is invalid.</p>' +
          '<p>The valid url path format:</p>' +
          '<p>http://some-example-domain.com/{format-(js, css)}/{compress-(0, 1)}/JS,CSS file path</p>';
        help.displayErrorPage(404, error, res);
      } else {
        assetHandler.fetchOriginFileContent(url, fileName, fileExt, compress, res);
      }
    } else if(paramString.split('/')[0] == 'fonts') {
      url = paramString.substring(paramString.split('/')[0].length + 1);
      fileName = url.split('/')[url.split('/').length - 1];
      fileExt = url.substring(url.lastIndexOf('.') + 1);
      if(supportExts.indexOf(fileExt.toLowerCase()) < 0) {
        error = '<p>Font file type should be TTF, OTF, WOFF, SVG or EOT.</p>';
        help.displayErrorPage(404, error, res);
      } else {
        assetHandler.fetchOriginFileContent(url, fileName, fileExt, 0, res);
      }
    } else {
//console.log(version)
//console.log(paramString.split('/').length)
      if (version === 'v1' && paramString.split('/').length < 15 &&
        !fs.existsSync(path.resolve(__dirname + '/../../../workspace/recipes/' + paramString.split('/')[0] + '.json'))) {
        var errorMessage = '<p>Url path is invalid.</p>' +
          '<p>The valid url path format:</p>' +
          '<p>http://some-example-domain.com/{format}/{quality}/{trim}/{trimFuzz}/{width}/{height}/{crop-x}/{crop-y}/{ratio}/{devicePixelRatio}/{resizeStyle}/{gravity}/{filter}/{blur}/{strip}/{rotate}/{flip}/Imagepath</p>';
        help.displayErrorPage(404, errorMessage, res);
      } else {
        if (fs.existsSync(path.resolve(__dirname + '/../../../workspace/recipes/' + paramString.split('/')[0] + '.json'))) {
          var recipePath = path.resolve(__dirname + '/../../../workspace/recipes/' + paramString.split('/')[0] + '.json');
          var recipe = require(recipePath);

          var referencePath = recipe.path?recipe.path:'';
          url = referencePath + '/' + paramString.substring(paramString.split('/')[0].length + 1);

          fileName = url.split('/')[url.split('/').length - 1];
          fileExt = url.substring(url.lastIndexOf('.') + 1);
          if(recipe.settings.format == 'js' || recipe.settings.format == 'css') {
            if(fileName.split('.').length == 1) {
              fileExt = recipe.settings.format;
              fileName = fileName + '.' + fileExt;
            }
            compress = recipe.settings.compress;
            if (compress != 0 && compress != 1) {
              error = '<p>Compress value should be 0 or 1.</p>';
              help.displayErrorPage(404, error, res);
            } else {
              assetHandler.fetchOriginFileContent(url, fileName, fileExt, compress, res);
            }
            options = {
              format: 'assets'
            };
          } else if(recipe.settings.format == 'fonts') {
            if(supportExts.indexOf(fileExt.toLowerCase()) < 0) {
              error = '<p>Font file type should be TTF, OTF, WOFF, SVG or EOT.</p>';
              help.displayErrorPage(404, error, res);
            } else {
              assetHandler.fetchOriginFileContent(url, fileName, fileExt, 0, res);
            }
            options = {
              format: 'assets'
            };
          } else {
            options = recipe.settings;
          }
        } else {

          if (version === 'v2') {
            var urlOptions = require('url').parse(req.url, true);
            url = urlOptions.pathname;
            fileName = urlOptions.pathname.substring(1);
            fileExt = path.extname(fileName).substring(1);
            options = urlOptions.query;
            if (typeof options.format === 'undefined') options.format = fileExt;
          }
          else {
            var optionsArray = paramString.split('/').slice(0, 17);
            url = paramString.substring(optionsArray.join('/').length + 1);
            fileName = url.split('/')[url.split('/').length - 1];
            fileExt = url.substring(url.lastIndexOf('.') + 1);
            options = getImageOptions(optionsArray, version);
          }
        }

        if(options.format != 'assets') {
          if (options.format == 'json') {
            returnJSON = true;
            if (fileExt == fileName) {
              options.format = 'PNG';
            } else {
              options.format = fileExt;
            }
          }

          var originFileName = fileName;

          if (config.get('security.maxWidth') && config.get('security.maxWidth') < options.width)
            options.width = config.get('security.maxWidth');
          if (config.get('security.maxHeight') && config.get('security.maxHeight') < options.height)
            options.height = config.get('security.maxHeight');

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

          if (config.get('caching.redis.enabled')) {
            self.cache.client().exists(encryptName, function (err, exists) {
              if (exists > 0) {
                var readStream = redisRStream(self.cache.client(), encryptName);
                if (returnJSON) {
                  imageHandler.fetchImageInformation(readStream, originFileName, modelName, options, res);
                } else {
                  // Set cache header
                  res.setHeader('X-Cache', 'HIT');
                  var buffers = [];
                  var fileSize = 0;

                  function lengthListener(length) {
                    fileSize = length;
                  }

                  if(config.get('gzip')) {
                    res.setHeader('content-encoding', 'gzip');
                    var gzipStream = readStream.pipe(zlib.createGzip());
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
        				    readStream = readStream.pipe(lengthStream(lengthListener));
        				    readStream.on('data', function (buffer) {
      				        buffers.push(buffer);
        				    });
        				    readStream.on('end', function () {
      				        var buffer = Buffer.concat(buffers);
      				        res.setHeader('Content-Length', fileSize);
      				        res.end(buffer);
        				    });
                  }
                }
              } else {
                // Set cache header
                res.setHeader('X-Cache', 'MISS');
                imageHandler.createNewConvertImage(req, originFileName, modelName, options, returnJSON, res);
              }
            });
          } else {
            var cacheDir = path.resolve(config.get('caching.directory.path'));
            var cachePath = path.join(cacheDir, encryptName);
            if (fs.existsSync(cachePath)) {
              fs.stat(cachePath, function (err, stats) {
                var lastMod = stats && stats.mtime && stats.mtime.valueOf();
                if (config.get('caching.ttl') && lastMod && (Date.now() - lastMod) / 1000 <= config.get('caching.ttl')) {
                  var readStream = fs.createReadStream(cachePath);
                  if (returnJSON) {
                    imageHandler.fetchImageInformation(readStream, originFileName, modelName, options, res);
                  } else {
                    // Set cache header
                    res.setHeader('X-Cache', 'HIT');

                    var buffers = [];
                    var fileSize = 0;

                    function lengthListener(length) {
                      fileSize = length;
                    }

                    if(config.get('gzip')) {
                    	res.setHeader('content-encoding', 'gzip');
                    	var gzipStream = readStream.pipe(zlib.createGzip());

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
        					    readStream = readStream.pipe(lengthStream(lengthListener));
        					    readStream.on('data', function (buffer) {
       					        buffers.push(buffer);
        					    });
        					    readStream.on('end', function () {
      					        var buffer = Buffer.concat(buffers);
      					        res.setHeader('Content-Length', fileSize);
      					        res.end(buffer);
        					    });
                    }
                  }
                } else {
                  // Set cache header
                  res.setHeader('X-Cache', 'MISS');
                  imageHandler.createNewConvertImage(req, originFileName, modelName, options, returnJSON, res);
                }
              });
            } else {
              // Set cache header
              res.setHeader('X-Cache', 'MISS');
              imageHandler.createNewConvertImage(req, originFileName, modelName, options, returnJSON, res);
            }
          }
        }
      }
    }
  });

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

  /**
   * Parses the request URL and returns an options object
   * @param {String} url - the request URL
   * @param {String} version - the version number extracted from the 'Accept' request header
   * @returns {object}
   */
  function getImageOptions (optionsArray, version) {

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
  AWS.config.update({
    accessKeyId: config.get('assets.s3.accessKey'),
    secretAccessKey: config.get('assets.s3.secretKey')
  });
  if(config.get('images.s3.region') && config.get('images.s3.region') != "") {
    AWS.config.update({
      region: config.get('images.s3.region')
    });
  }

  this.assetsS3 = new AWS.S3();
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
