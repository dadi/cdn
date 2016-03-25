var compressor = require('node-minify');
var request = require('request');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');
var sha1 = require('sha1');

var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');

var AssetHandle = function(assetsS3, cache) {
  this.cache = cache;
  this.assetsS3 = assetsS3;
};
/**
 * Fetch JS, CSS file from S3, Remote or local disk
 */
AssetHandle.prototype.fetchOriginFileContent = function (url, fileName, fileExt, compress, res) {
  var self = this;
  if (config.get('assets.remote.enabled')) { // Load file from http or https url
    url = config.get('assets.remote.path') + '/' + url;
    request({url: url}, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        self.compressJsCSSFiles(request({url: url}), fileName, fileExt, compress, res);
      } else {
        help.displayErrorPage(404, 'File path not valid.', res);
      }
    });
  } else if (config.get('assets.s3.enabled')) { //Load file from S3
    if(url.substring(0, 1) == '/') url = url.substring(1);
    self.assetsS3.getObject({Bucket: config.get('assets.s3.bucketName'), Key: url}, function (err, data) {
      if (err) {
        help.displayErrorPage(404, err, res);
      } else {
        var s3ReadStream = self.assetsS3.getObject({
          Bucket: config.get('assets.s3.bucketName'),
          Key: url
        }).createReadStream();
        self.compressJsCSSFiles(s3ReadStream, fileName, fileExt, compress, res);
      }
    });
  } else {
    var resourceDir = path.resolve(config.get('assets.directory.path'));
    url = path.join(resourceDir, url);
    if (fs.existsSync(url)) {
      var readStream = fs.createReadStream(url);
      self.compressJsCSSFiles(readStream, fileName, fileExt, compress, res);
    } else {
      help.displayErrorPage(404, 'File "' + url + '" doesn\'t exist.', res);
    }
  }
};

/**
 * Compress JS, CSS files
 */
AssetHandle.prototype.compressJsCSSFiles = function (readStream, fileName, fileExt, compress, res) {
  var self = this;
  var encryptName = sha1(fileName);
  if(compress == 1) {
    if(!fs.existsSync(path.resolve('./tmp'))) fs.mkdirSync(path.resolve('./tmp'));
    var fileIn = path.join(path.resolve('./tmp'), fileName);
    var newFileName = fileName.split('.')[0] + '.min.' + fileName.split('.')[1];
    readStream.pipe(fs.createWriteStream(fileIn)).on('finish', function () {
      var fileOut = path.join(path.resolve('./tmp'), newFileName);
      if (fileExt == 'js') {
        new compressor.minify({
          type: 'uglifyjs',
          fileIn: fileIn,
          fileOut: fileOut,
          callback: function (err, min) {
            if (err) {
              help.displayErrorPage(404, err, res);
            } else {
              fs.unlinkSync(fileIn);
              var newReadStream = fs.createReadStream(fileOut);
              newReadStream.on('close', function(){
                fs.unlink(fileOut);
              });
              self.cache.cacheJSCSSFiles(newReadStream, encryptName, function() {
                if (fileExt == 'js') res.setHeader('Content-Type', 'application/javascript');
                else if (fileExt == 'css') res.setHeader('Content-Type', 'text/css');

                if(config.get('gzip')) {
                  res.setHeader('content-encoding', 'gzip');
                  newReadStream.pipe(zlib.createGzip()).pipe(res);
                } else {
                  newReadStream.pipe(res);
                }
              });
            }
          }
        });
      } else if (fileExt == 'css') {
        new compressor.minify({
          type: 'sqwish',
          fileIn: fileIn,
          fileOut: fileOut,
          callback: function (err, min) {
            if (err) {
              help.displayErrorPage(404, err, res);
            } else {
              fs.unlinkSync(fileIn);
              var newReadStream = fs.createReadStream(fileOut);
              newReadStream.on('close', function(){
                fs.unlink(fileOut);
              });
              self.cache.cacheJSCSSFiles(newReadStream, encryptName, function() {
                if (fileExt == 'js') res.setHeader('Content-Type', 'application/javascript');
                else if (fileExt == 'css') res.setHeader('Content-Type', 'text/css');

                if(config.get('gzip')) {
                  res.setHeader('content-encoding', 'gzip');
                  newReadStream.pipe(zlib.createGzip()).pipe(res);
                } else {
                  newReadStream.pipe(res);
                }
              });
            }
          }
        });
      }
    });
  } else {
    self.cache.cacheJSCSSFiles(readStream, encryptName, function() {
      if (fileExt == 'js') res.setHeader('Content-Type', 'application/javascript');
      else if (fileExt == 'css') res.setHeader('Content-Type', 'text/css');

      if(config.get('gzip')) {
        res.setHeader('content-encoding', 'gzip');
        readStream.pipe(zlib.createGzip()).pipe(res);
      } else {
        newReadStream.pipe(res);
      }
    });
  }
};

// exports
module.exports = function (assetsS3, client) {
  return new AssetHandle(assetsS3, client);
};

module.exports.AssetHandle = AssetHandle;