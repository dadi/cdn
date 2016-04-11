var cloudfront = require('cloudfront');
var concat = require('concat-stream')
var fs = require('fs');
var lengthStream = require('length-stream');
var nodeUrl = require('url');
var path = require('path');
var redis = require('redis');
var sha1 = require('sha1');
var zlib = require('zlib');
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

    factory.create(req).then(function(handler) {
      handler.get().then(function(stream) {

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

        // get the length of the stream
        var contentLength = 0;
        function lengthListener(length) {
          contentLength = length;
        }

        // receive the concatenated buffer and send the response
        function sendBuffer(buffer) {
          res.setHeader('Content-Length', contentLength);
          res.end(buffer);
        }

        var concatStream = concat(sendBuffer)

        if (config.get('gzip')) {
          res.setHeader('content-encoding', 'gzip')
          var gzipStream = stream.pipe(zlib.createGzip())
          gzipStream = gzipStream.pipe(lengthStream(lengthListener));
          gzipStream.pipe(concatStream)
        }
        else {
          stream.pipe(lengthStream(lengthListener))
          stream.pipe(concatStream)
        }
      }).catch(function(err) {
        help.displayErrorPage(err.statusCode, err.message, res);
      })
    }).catch(function(err) {
      help.displayErrorPage(err.statusCode || 400, err.message, res);
    })
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
