var site = require('../../package.json').name
var version = require('../../package.json').version
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])
var colors = require('colors')
var bodyParser = require('body-parser')
var finalhandler = require('finalhandler')
var fs = require('fs')
var http = require('http')
var path = require('path')
var Router = require('router')
var router = Router()
var _ = require('underscore')
var dadiStatus = require('@dadi/status')

// let's ensure there's at least a dev config file here
var devConfigPath = __dirname + '/../../config/config.development.json'
try {
  var stats = fs.statSync(devConfigPath)
} catch (err) {
  if (err.code === 'ENOENT') {
    fs.writeFileSync(devConfigPath, fs.readFileSync(devConfigPath + '.sample'))
  }
}

var auth = require(__dirname + '/auth')
var controller = require(__dirname + '/controller')
var configPath = path.resolve(__dirname + '/../../config')
var config = require(configPath)

var Server = function () {}

Server.prototype.start = function (done) {
  var self = this

  router.use(bodyParser.json({limit: '50mb'}))

  router.get('/', function (req, res, next) {
    res.end('Welcome to DADI CDN')
  })

  var statusHandler = function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    var authorization = req.headers.authorization

    // /status should be authenticated (using the same keys as used for the invalidation API),
    // config.get('status.requireAuthentication')
    // anything to do with auth(router) below?

    if (method !== 'post' || config.get('status.enabled') === false) {
      if (next) {
        return next()
      } else {
        // if we're running an independent endpoint, send back a quick 400 response
        var resBody = JSON.stringify({
          status: 400,
          error: 'bad request'
        })
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Length', Buffer.byteLength(resBody))
        res.end(resBody)
      }

    } else {
      var params = {
        site: site,
        package: '@dadi/cdn',
        version: version,
        healthCheck: {
          authorization: authorization,
          baseUrl: 'http://' + config.get('server.host') + ':' + config.get('server.port'),
          routes: config.get('status.routes')
        }
      }

      dadiStatus(params, function(err, data) {
        if (err) return next(err)
        var resBody = JSON.stringify(data, null, 2)

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Length', Buffer.byteLength(resBody))
        return res.end(resBody)
      })
    }
  }

  // if the status endpoint is set to be independent, then we need to create a fresh http server
  if (config.get('status.independent')) {
    var statusApp = http.createServer(statusHandler)
    var statusServer = this.statusServer = statusApp.listen(config.get('status.port'))
    statusServer.on('listening', function () { onStatusListening(this) })
    // TODO: sync this up with `server` so `this.readyState = 1` is true?
  } else {
    router.use('/status', statusHandler)
  }

  auth(router)

  controller(router)

  var app = http.createServer(function (req, res) {
    config.updateConfigDataForDomain(req.headers.host)

    res.setHeader('Server', config.get('server.name'))
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (config.get('clientCache.cacheControl')) res.setHeader('Cache-Control', config.get('clientCache.cacheControl'))
    if (config.get('clientCache.etag')) res.setHeader('ETag', config.get('clientCache.etag'))

    router(req, res, finalhandler(req, res))
  })

  var server = this.server = app.listen(config.get('server.port'))
  server.on('listening', function () { onListening(this) })

  this.readyState = 1

  done && done()
}

function onListening (server) {
  var env = config.get('env')
  var address = server.address()

  if (env !== 'test') {
    var startText = '\n  ----------------------------\n'
    startText += "  Started 'DADI CDN'\n"
    startText += '  ----------------------------\n'
    startText += '  Server:      '.green + address.address + ':' + address.port + '\n'
    startText += '  Version:     '.green + version + '\n'
    startText += '  Node.JS:     '.green + nodeVersion + '\n'
    startText += '  Environment: '.green + env + '\n'
    startText += '  ----------------------------\n'

    startText += '\n\n  Copyright ' + String.fromCharCode(169) + ' 2015 DADI+ Limited (https://dadi.tech)'.white + '\n'

    console.log(startText)
  }
}

function onStatusListening (server) {
  var env = config.get('env')
  var address = server.address()

  if (env !== 'test') {
    var startText = '\n  ----------------------------\n'
    startText += "  Started independent status endpoint\n"
    startText += '  ----------------------------\n'
    startText += '  Server:      '.green + address.address + ':' + address.port + '\n'
    startText += '  ----------------------------\n'

    console.log(startText)
  }
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
  var self = this
  this.readyState = 3

  this.server.close(function (err) {
    self.readyState = 0
    done && done(err)
  })
}

module.exports = new Server()
