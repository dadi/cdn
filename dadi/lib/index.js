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

    if (method !== 'post' || config.get('status.enabled') === false) {
      return next()
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

        var responseMessages = {
          Green: 'Service is responding within specified parameters',
          Amber: 'Service is responding, but outside of specified parameters'
        }

        data.status = {
          status: data.routes[0].status,
          healthStatus: data.routes[0].healthStatus,
          message: responseMessages[data.routes[0].healthStatus] || 'Service is not responding correctly'
        }

        var resBody = JSON.stringify(data, null, 2)

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Length', Buffer.byteLength(resBody))
        return res.end(resBody)
      })
    }
  }

  // ensure that middleware runs in the correct order,
  // especially when running an integrated status page
  if (config.get('status.standalone')) {
    var statusRouter = Router()
    config.get('status.requireAuthentication') && auth(statusRouter)
    statusRouter.use('/api/status', statusHandler)

    var statusApp = http.createServer(function (req, res) {
      res.setHeader('Server', config.get('server.name'))
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 'no-cache')
      statusRouter(req, res, finalhandler(req, res))
    })

    var statusServer = this.statusServer = statusApp.listen(config.get('status.port'))
    statusServer.on('listening', function () { onStatusListening(this) })

    auth(router)
  } else {
    if (config.get('status.requireAuthentication')) {
      auth(router)
      router.use('/api/status', statusHandler)
    } else {
      router.use('/api/status', statusHandler)
      auth(router)
    }
  }

  controller(router)

  var app = http.createServer(function (req, res) {
    config.updateConfigDataForDomain(req.headers.host)

    res.setHeader('Server', config.get('server.name'))
    res.setHeader('Access-Control-Allow-Origin', '*')

    if (config.get('clientCache.cacheControl')) res.setHeader('Cache-Control', config.get('clientCache.cacheControl'))
    if (config.get('clientCache.etag')) res.setHeader('ETag', config.get('clientCache.etag'))
    if (req.url === '/api/status') res.setHeader('Cache-Control', 'no-cache')

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
    startText += "  Started standalone status endpoint\n"
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
    // if statusServer is running in standalone, close that too
    if (self.statusServer) {
      self.statusServer.close(function (err) {
        self.readyState = 0
        done && done(err)
      })
    } else {
      self.readyState = 0
      done && done(err)
    }
  })
}

module.exports = new Server()
