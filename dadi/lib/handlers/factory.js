var _ = require('underscore')
var fs = require('fs')
var path = require('path')
var Promise = require('bluebird')
var url = require('url')

var AssetHandler = require(path.join(__dirname, '/asset'))
var ImageHandler = require(path.join(__dirname, '/image'))
var Route = require(path.join(__dirname, '/../models/route'))

var config = require(path.join(__dirname, '/../../../config'))

function parseUrl (req) {
  return url.parse(req.url, true)
}

function getFormat (version, req) {
  var parsedPath = parseUrl(req).pathname

  if (version === 'v1') {
    return _.compact(parsedPath.split('/'))[0]
  } else if (version === 'v2') {
    return path.extname(parsedPath).replace('.', '').toLowerCase()
  }
}

var HandlerFactory = function () {
  this.handlers = []
  this.currentHandler = -1

  // Add handlers in order
  this.handlers.push(this.createFromFormat)
  this.handlers.push(this.createFromRoute)
  this.handlers.push(this.createFromRecipe)
  this.handlers.push(this.getProcessor)
}

HandlerFactory.prototype.create = function (req) {
  // set a default version
  var version = 'v1'
  var parsedUrl = url.parse(req.url, true)
  var pathComponents = parsedUrl.pathname.slice(1).split('/')

  // Set version 2 if the path doesn't contain any slashes that aren't part
  // of an external image URL
  if ((pathComponents.length === 1) || (['http:', 'https:'].indexOf(pathComponents[0]) === 0)) {
    version = 'v2'

    if (!parsedUrl.search) {
      parsedUrl.search = '?version=v2'

      req.url = url.format(parsedUrl)
    }
  }

  var format = getFormat(version, req)

  return this.callNextHandler(format, req)
}

HandlerFactory.prototype.callNextHandler = function (format, req) {
  this.currentHandler++

  if (!this.handlers[this.currentHandler]) {
    var error = new Error('Unknown URI')

    error.statusCode = 404
    error.detail = `'${format}' is not a valid route, recipe, processor or image format`

    return Promise.reject(error)
  }

  return this.handlers[this.currentHandler].call(this, format, req)
}

HandlerFactory.prototype.createFromFormat = function (format, req) {
  return new Promise((resolve, reject) => {
    switch (format) {
      case 'css':
      case 'js':
      case 'fonts':
      case 'ttf':
      case 'otf':
      case 'woff':
      case 'svg':
      case 'eot':
        return resolve(new AssetHandler(format, req))
      case 'gif':
      case 'jpg':
      case 'jpeg':
      case 'json':
      case 'png':
        return resolve(new ImageHandler(format, req))
      default:
        return resolve(this.callNextHandler(format, req))
    }
  })
}

HandlerFactory.prototype.getProcessor = function (format, req) {
  return new Promise((resolve, reject) => {
    var processorPath = path.join(path.resolve(config.get('paths.processors')), format + '.js')

    fs.stat(processorPath, (err, stats) => {
      if ((err && (err.code === 'ENOENT')) || !stats.isFile()) {
        return resolve(this.callNextHandler(format, req))
      } else if (err) {
        return reject(err)
      }

      var Processor = require(processorPath)

      return resolve(new Processor(format, req))
    })
  })
}

HandlerFactory.prototype.createFromRoute = function (format, req) {
  return new Promise((resolve, reject) => {
    var routePath = path.join(path.resolve(config.get('paths.routes')), format + '.json')

    fs.stat(routePath, (err, stats) => {
      if ((err && (err.code === 'ENOENT')) || !stats.isFile()) {
        return resolve(this.callNextHandler(format, req))
      } else if (err) {
        return reject(err)
      }

      var route = new Route(require(routePath))

      route.setIP(req.connection.remoteAddress)
      route.setLanguage(req.headers['accept-language'])
      route.setUserAgent(req.headers['user-agent'])

      return resolve(route.getRecipe().then((recipe) => {
        if (recipe) {
          return this.createFromRecipe(recipe, req, format)
        }

        return this.callNextHandler(format, req)
      }))
    })
  })
}

HandlerFactory.prototype.createFromRecipe = function (format, req, fromRoute) {
  return new Promise((resolve, reject) => {
    var recipePath = path.join(path.resolve(config.get('paths.recipes')), format + '.json')

    fs.stat(recipePath, (err, stats) => {
      if ((err && (err.code === 'ENOENT')) || !stats.isFile()) {
        return resolve(this.callNextHandler(format, req))
      } else if (err) {
        return reject(err)
      }

      var recipe = require(recipePath)

      this.createFromFormat(recipe.settings.format, req).then((handler) => {
        var referencePath = recipe.path ? recipe.path : ''
        var filePath = parseUrl(req).pathname.replace(format, '').replace(fromRoute, '')
        var fullPath = path.join(referencePath, filePath)

        handler.url = fullPath
        handler.fileName = path.basename(parseUrl(req).pathname.replace(format, ''))
        handler.fileExt = path.extname(parseUrl(req).pathname).replace('.', '')
        handler.compress = recipe.settings.compress ? recipe.settings.compress.toString() : '0'
        handler.options = recipe.settings

        return resolve(handler)
      }).catch((err) => {
        return reject(err)
      })
    })
  })
}

module.exports = function () {
  return new HandlerFactory()
}

module.exports.HandlerFactory = HandlerFactory
