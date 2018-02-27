'use strict'

const he = require('he')
const mime = require('mime')
const path = require('path')
const url = require('url')

const AssetHandler = require(path.join(__dirname, '/asset'))
const ImageHandler = require(path.join(__dirname, '/image'))
const JSHandler = require(path.join(__dirname, '/js'))
const PluginHandler = require(path.join(__dirname, '/plugin'))
const Route = require(path.join(__dirname, '/../models/Route'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

function parseUrl (req) {
  return url.parse(req.url, true)
}

function getFormat (version, req) {
  let parsedPath = parseUrl(req).pathname

  // add default jpg extension
  if (path.extname(parsedPath) === '') {
    parsedPath += '.jpg'
  }

  if (version === 'v1') {
    return parsedPath.split('/').find(Boolean)
  } else if (version === 'v2') {
    return path.extname(parsedPath).replace('.', '').toLowerCase()
  }
}

const HandlerFactory = function () {}

HandlerFactory.prototype.create = function (req, mimetype) {
  const parsedUrl = url.parse(req.url, true)
  const pathComponents = parsedUrl.pathname.slice(1).split('/')
  let format
  let version

  // version 1 matches a string like /jpg/80/0/0/640/480/ at the beginning of the url pathname
  const v1pattern = /^\/[a-z]{3,4}\/[0-9]+\/[0-1]+\/[0-1]+\/[0-9]+\/[0-9]+\//gi

  if (v1pattern.test(parsedUrl.pathname) || /\/(fonts|css|js)/.test(pathComponents[0])) {
    req.__cdnLegacyURLSyntax = true

    version = 'v1'
  } else {
    version = 'v2'

    // ensure the querystring is decoded (removes for eg &amp; entities introduced via XSLT)
    if (parsedUrl.search) {
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
    return this.createFromFormat({
      format,
      req
    })
  } else {
    // Check if a workspace file matches the first part of the path.
    const workspaceMatch = workspace.get(pathComponents[0])

    switch (workspaceMatch && workspaceMatch.type) {
      case 'plugins':
        return this.createFromPlugin({
          plugin: require(workspaceMatch.path),
          req
        })

      case 'recipes':
        return this.createFromRecipe({
          name: pathComponents[0],
          req
        })

      case 'routes':
        return this.createFromRoute({
          name: pathComponents[0],
          req
        })

      default:
        return this.createFromFormat({
          format,
          req
        })
    }
  }
}

HandlerFactory.prototype.callErrorHandler = function (format, req) {
  const error = new Error('Unknown URI')

  error.statusCode = 404
  error.detail = `'${format}' is not a valid route, recipe, processor or image format`

  return Promise.reject(error)
}

HandlerFactory.prototype.createFromFormat = function ({format, plugins, req}) {
  let handlerData = {
    plugins
  }

  return new Promise((resolve, reject) => {
    switch (format) {
      case 'js':
        return resolve(new JSHandler(format, req))
      case 'css':
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
        return resolve(new ImageHandler(format, req, handlerData))
      case 'bin':
        format = 'jpg'
        return resolve(new ImageHandler(format, req, handlerData))
      default:
        return resolve(this.callErrorHandler(format, req))
    }
  })
}

HandlerFactory.prototype.createFromPlugin = function ({plugin, req}) {
  return Promise.resolve(new PluginHandler(req, plugin))
}

HandlerFactory.prototype.createFromRecipe = function ({name, req, route}) {
  const workspaceMatch = workspace.get(name)

  if (!workspaceMatch || workspaceMatch.type !== 'recipes') {
    return Promise.reject(new Error('Recipe not found'))
  }

  const parsedUrl = url.parse(req.url, true)
  const recipe = workspaceMatch.source

  return this.createFromFormat({
    format: recipe.settings.format,
    plugins: recipe.plugins,
    req
  }).then(handler => {
    // We'll remove the first part of the URL, corresponding
    // to the name of the recipe, which will leave us with the
    // path to the file.
    const filePath = parsedUrl.pathname
      .replace(new RegExp('^/' + name + '/'), '/')
      .replace(new RegExp('^/' + route + '/'), '/')

    // Does the recipe specify a base path?
    const fullPath = recipe.path
      ? path.join(recipe.path, filePath)
      : filePath

    handler.setBaseUrl(fullPath)

    // handler.url = fullPath
    // handler.fileName = path.basename(parseUrl(req).pathname.replace(name, ''))
    // handler.fileExt = path.extname(parseUrl(req).pathname).replace('.', '')
    handler.compress = recipe.settings.compress ? recipe.settings.compress.toString() : '0'
    handler.options = Object.assign({}, recipe.settings, parsedUrl.query)

    return handler
  })
}

HandlerFactory.prototype.createFromRoute = function ({name, req}) {
  const workspaceMatch = workspace.get(name)

  if (!workspaceMatch || workspaceMatch.type !== 'routes') {
    return Promise.reject(new Error('Route not found'))
  }

  const route = new Route(workspaceMatch.source)

  route.setLanguage(req.headers['accept-language'])
  route.setUserAgent(req.headers['user-agent'])

  return route.getRecipe().then(recipe => {
    if (recipe) {
      return this.createFromRecipe({
        name: recipe,
        req,
        route: name
      })
    }

    return this.callErrorHandler(name, req)
  })
}

module.exports = function () {
  return new HandlerFactory()
}

module.exports.HandlerFactory = HandlerFactory
