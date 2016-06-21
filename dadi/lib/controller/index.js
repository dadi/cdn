var cloudfront = require('cloudfront')
var concat = require('concat-stream')
var fs = require('fs')
var lengthStream = require('length-stream')
var PassThrough = require('stream').PassThrough
var path = require('path')
var sha1 = require('sha1')
var zlib = require('zlib')
var _ = require('underscore')

var logger = require('@dadi/logger')

var configPath = path.resolve(__dirname + '/../../../config')
var config = require(__dirname + '/../../../config')
var help = require(__dirname + '/../help')
var monitor = require(__dirname + '/../monitor')
var HandlerFactory = require(__dirname + '/../handlers/factory')

logger.init(config.get('logging'), config.get('aws'), config.get('env'))

var Controller = function (router) {
  var self = this
  this.monitors = {}

  // Monitor config.json file
  self.addMonitor(configPath, function (filename) {
    delete require.cache[configPath]
    config = require(configPath)
  })

  // Monitor recipes folders and files
  var recipeDir = path.resolve(config.get('paths.recipes'))

  self.addMonitor(recipeDir, function (filename) {
    delete require.cache[recipeDir + '/' + filename]
  })

  router.use(logger.requestLogger)

  router.get(/(.+)/, function (req, res) {
    var factory = new HandlerFactory()

    factory.create(req).then(function (handler) {
      return handler.get().then(function (stream) {
        if (handler.contentType()) {
          res.setHeader('Content-Type', handler.contentType())
        }

        if (handler.cached) {
          res.setHeader('X-Cache', 'HIT')
        } else {
          res.setHeader('X-Cache', 'MISS')
        }

        var contentLength = 0

        // receive the concatenated buffer and send the response
        function sendBuffer (buffer) {
          res.setHeader('Content-Length', contentLength)
          res.end(buffer)
        }

        function lengthListener (length) {
          contentLength = length
        }

        var concatStream = concat(sendBuffer)

        if (config.get('gzip')) {
          res.setHeader('Content-Encoding', 'gzip')
          var gzipStream = stream.pipe(zlib.createGzip())
          gzipStream = gzipStream.pipe(lengthStream(lengthListener))
          gzipStream.pipe(concatStream)
        } else {
          stream.pipe(lengthStream(lengthListener)).pipe(concatStream)
        }
      }).catch(function (err) {
        logger.error({err: err})
        help.displayErrorPage(err.statusCode, err.message, res)
      })
    }).catch(function (err) {
      help.sendBackJSON(err.statusCode || 400, err, res)
      //help.displayErrorPage(err.statusCode || 400, err.message, res)
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
}

Controller.prototype.addMonitor = function (filepath, callback) {
  filepath = path.normalize(filepath)
  if (this.monitors[filepath]) return
  var m = monitor(filepath)
  m.on('change', callback)
  this.monitors[filepath] = m
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
