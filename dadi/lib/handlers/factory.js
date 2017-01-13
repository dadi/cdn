var _ = require('underscore')
var fs = require('fs')
var he = require('he')
var mime = require('mime')
var path = require('path')
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

  // add default jpg extension
  if (path.extname(parsedPath) === '') {
    parsedPath += '.jpg'
  }

  if (version === 'v1') {
    return _.compact(parsedPath.split('/'))[0]
  } else if (version === 'v2') {
    return path.extname(parsedPath).replace('.', '').toLowerCase()
  }
}

var HandlerFactory = function () {
  this.handlers = []
  this.currentHandler = -1

  this.getWorkspaceFiles()

  // Add handlers in order
  this.handlers.push(this.createFromRoute)
  this.handlers.push(this.createFromRecipe)
  this.handlers.push(this.getProcessor)
}

HandlerFactory.prototype.create = function (req, mimetype) {
  var version
  var parsedUrl = url.parse(req.url, true)
  var pathComponents = parsedUrl.pathname.slice(1).split('/')
  var format

  // version 1 matches a string like /jpg/80/0/0/640/480/ at the beginning of the url pathname
  var v1pattern = /^\/[a-z]{3,4}\/[0-9]+\/[0-1]+\/[0-1]+\/[0-9]+\/[0-9]+\//gi

  if (v1pattern.test(parsedUrl.pathname) || /fonts|css|js/.test(pathComponents[0])) {
    version = 'v1'
  } else {
    version = 'v2'

    // add a default querystring if one wasn't supplied
    if (!parsedUrl.search) {
      parsedUrl.search = '?version=2'

      req.url = url.format(parsedUrl)
    } else {
      // ensure the querystring is decoded (removes for eg &amp; entities introduced via XSLT)
      parsedUrl.search = he.decode(parsedUrl.search)
      req.url = url.format(parsedUrl)
    }
  }

  if (!mimetype) {
    format = getFormat(version, req)
  } else {
    format = mime.extension(mimetype)
  }

  // try to create a handler
  if (version === 'v1') {
    return this.createFromFormat(format, req)
  } else {
    // check if a workspace file matches the first part of the path
    if (_.contains(this.workspaceFiles, pathComponents[0])) {
      return this.callNextHandler(pathComponents[0], req)
    } else {
      // else it's an image request, regardless of path
      return this.createFromFormat(format, req)
    }
  }
}

HandlerFactory.prototype.getWorkspaceFiles = function () {
  var processors = fs.readdirSync(path.resolve(config.get('paths.processors')))
  var recipes = fs.readdirSync(path.resolve(config.get('paths.recipes')))
  var routes = fs.readdirSync(path.resolve(config.get('paths.routes')))

  this.workspaceFiles = _.map(_.filter(_.union(processors, recipes, routes), (file) => {
    return path.extname(file) === '.json'
  }), (file) => {
    return path.basename(file, '.json')
  })
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
      case 'bin':
        format = 'jpg'
        return resolve(new ImageHandler(format, req))
      default:
        return resolve(this.callNextHandler(format, req))
    }
  })
}

HandlerFactory.prototype.getProcessor = function (inputString, req) {
  return new Promise((resolve, reject) => {
    var processorPath = path.join(path.resolve(config.get('paths.processors')), inputString + '.js')

    fs.stat(processorPath, (err, stats) => {
      if ((err && (err.code === 'ENOENT')) || !stats.isFile()) {
        return resolve(this.callNextHandler(inputString, req))
      } else if (err) {
        return reject(err)
      }

      var Processor = require(processorPath)

      return resolve(new Processor(inputString, req))
    })
  })
}

HandlerFactory.prototype.createFromRoute = function (inputString, req) {
  return new Promise((resolve, reject) => {
    var routePath = path.join(path.resolve(config.get('paths.routes')), inputString + '.json')

    fs.stat(routePath, (err, stats) => {
      if ((err && (err.code === 'ENOENT')) || !stats.isFile()) {
        return resolve(this.callNextHandler(inputString, req))
      } else if (err) {
        return reject(err)
      }

      var route = new Route(require(routePath))

      route.setIP(req.connection.remoteAddress)
      route.setLanguage(req.headers['accept-language'])
      route.setUserAgent(req.headers['user-agent'])

      return resolve(route.getRecipe().then((recipe) => {
        if (recipe) {
          return this.createFromRecipe(recipe, req, inputString)
        }

        return this.callNextHandler(inputString, req)
      }))
    })
  })
}

HandlerFactory.prototype.createFromRecipe = function (inputString, req, fromRoute) {
  return new Promise((resolve, reject) => {
    var recipePath = path.join(path.resolve(config.get('paths.recipes')), inputString + '.json')

    fs.stat(recipePath, (err, stats) => {
      if ((err && (err.code === 'ENOENT')) || !stats.isFile()) {
        return resolve(this.callNextHandler(inputString, req))
      } else if (err) {
        return reject(err)
      }

      var recipe = require(recipePath)

      this.createFromFormat(recipe.settings.format, req).then((handler) => {
        var referencePath = recipe.path ? recipe.path : ''
        var filePath = parseUrl(req).pathname.replace(inputString, '').replace(fromRoute, '')
        var fullPath = path.join(referencePath, filePath)

        handler.url = fullPath
        handler.fileName = path.basename(parseUrl(req).pathname.replace(inputString, ''))
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
