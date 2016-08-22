var cloudfront = require('cloudfront')
var concat = require('concat-stream')
var etag = require('etag')
var fs = require('fs')
var lengthStream = require('length-stream')
var mime = require('mime')
var PassThrough = require('stream').PassThrough
var path = require('path')
var sha1 = require('sha1')
var zlib = require('zlib')
var _ = require('underscore')

var logger = require('@dadi/logger')

var configPath = path.resolve(__dirname + '/../../../config')
var config = require(__dirname + '/../../../config')
var help = require(__dirname + '/../help')
var HandlerFactory = require(__dirname + '/../handlers/factory')
var RouteController = require(__dirname + '/route')

logger.init(config.get('logging'), config.get('aws'), config.get('env'))

var Controller = function (router) {
  var self = this

  router.use(logger.requestLogger)

  router.get(/(.+)/, function (req, res) {
    var factory = new HandlerFactory()

    factory.create(req).then(function (handler) {
      return handler.get().then(function (stream) {

        self.addContentTypeHeader(res, handler)
        self.addCacheControlHeader(res, handler)
        self.addLastModifiedHeader(res, handler)

        if (handler.storageHandler && handler.storageHandler.notFound) {
          res.statusCode = config.get('notFound.statusCode') || 404
        }

        var contentLength = 0

        // receive the concatenated buffer and send the response
        // unless the etag hasn't changed, then send 304 and end the response
        function sendBuffer (buffer) {
          res.setHeader('Content-Length', contentLength)
          res.setHeader('ETag', etag(buffer))

          if (req.headers['if-none-match'] === etag(buffer) && handler.contentType() !== 'application/json') {
            res.statusCode = 304
            res.end()
          } else {
            if (handler.cached) {
              res.setHeader('X-Cache', 'HIT')
            } else {
              res.setHeader('X-Cache', 'MISS')
            }

            res.end(buffer)
          }
        }

        function lengthListener (length) {
          contentLength = length
        }

        var concatStream = concat(sendBuffer)

        if (config.get('headers.useGzipCompression') && handler.contentType() !== 'application/json') {
          res.setHeader('Content-Encoding', 'gzip')

          var gzipStream = stream.pipe(zlib.createGzip())
          gzipStream = gzipStream.pipe(lengthStream(lengthListener))
          gzipStream.pipe(concatStream)
        } else {
          stream.pipe(lengthStream(lengthListener)).pipe(concatStream)
        }
      }).catch(function (err) {
        logger.error({err: err})
        help.sendBackJSON(err.statusCode || 400, err, res)
      })
    }).catch(function (err) {
      help.sendBackJSON(err.statusCode || 400, err, res)
    })
  })

  // Invalidation request
  router.post('/api', function (req, res) {
    if (req.body.invalidate) {
      var invalidate = ''
      if (req.body.invalidate && req.body.invalidate !== '*')
        invalidate = sha1(req.body.invalidate)

      help.clearCache(invalidate, function (err) {
        if (config.get('cloudfront.enabled')) {
          var cf = cloudfront.createClient(config.get('cloudfront.accessKey'), config.get('cloudfront.secretKey'))
          cf.getDistribution(config.get('cloudfront.distribution'), function (err, distribution) {
            var callerReference = (new Date()).toString()
            distribution.invalidate(callerReference, ['/' + req.body.invalidate], function (err, invalidation) {
              if (err) console.log(err)

              help.sendBackJSON(200, {
                result: 'success',
                message: 'Succeed to clear'
              }, res)
            })
          })
        } else {
          help.sendBackJSON(200, {
            result: 'success',
            message: 'Succeed to clear'
          }, res)
        }
      })
    } else {
      help.sendBackJSON(400, {
        result: 'Failed',
        message: "Please pass 'invalidate' path"
      }, res)
    }
  })

  router.post('/api/recipes/new', function (req, res) {

    // Don't accept an empty POST
    if (_.isEmpty(req.body)) {
      return help.sendBackJSON(400, {
        message: 'Bad Request'
      }, res)
    }

    // Valid JSON?
    try {
      var recipe = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
    }
    catch(err) {
      return help.sendBackJSON(400, {
        message: 'Invalid JSON Syntax'
      }, res)
    }

    // Check for expected properties
    var validation = self.validateRecipe(recipe)
    if (!validation.success) {
      return help.sendBackJSON(400, {
        error: validation.errors
      }, res)
    }

    var recipePath = path.join(config.get('paths.recipes'), recipe.recipe) + '.json'

    try {
      fs.writeFileSync(recipePath, JSON.stringify(recipe, null, 2))

      help.sendBackJSON(201, {
        result: 'success',
        message: `Recipe "${recipe.recipe}" created`
      }, res)
    }
    catch (err) {
      console.log(err)
    }
  })

  router.post('/api/routes', function (req, res) {
    return RouteController.post(req, res)
  })
}

Controller.prototype.addContentTypeHeader = function (res, handler) {
  if (handler.contentType()) {
    res.setHeader('Content-Type', handler.contentType())
  }
}

Controller.prototype.addLastModifiedHeader = function (res, handler) {
  if (!handler) return

  if (handler.getLastModified) {
    res.setHeader('Last-Modified', handler.getLastModified())
  }
}

Controller.prototype.addCacheControlHeader = function (res, handler) {

  var configHeaderSets = config.get('headers.cacheControl')

  // If it matches, sets Cache-Control header using the file path
  _.each(configHeaderSets.paths, function (obj) {
    var key = Object.keys(obj)[0]
    var value = obj[key]

    if (handler.storageHandler.getFullUrl().indexOf(key) > -1) {
      setHeader(value)
    }
  })

  // If not already set, sets Cache-Control header using the file mimetype
  _.each(configHeaderSets.mimetypes, function (obj) {
    var key = Object.keys(obj)[0]
    var value = obj[key]

    if (mime.lookup(handler.getFilename()) === key) {
      setHeader(value)
    }
  })

  // If not already set, sets Cache-Control header using the default
  setHeader(configHeaderSets.default)

  function setHeader(value) {
    if (_.isEmpty(value)) return

    // already set
    if (res._headers['cache-control']) return

    // set the header
    res.setHeader('Cache-Control', value)
  }
}

Controller.prototype.validateRecipe = function (recipe) {
  var required = ['recipe', 'path', 'settings']
  var errors = []
  for (var key in required) {
    if (!recipe.hasOwnProperty(required[key])) {
      errors.push({ error: `Property "${required[key]}" not found in recipe` })
    }
  }

  return {
    success: errors.length === 0,
    errors: errors
  }
}

module.exports = function (model) {
  return new Controller(model)
}
