'use strict'

const he = require('he')
const logger = require('@dadi/logger')
const mime = require('mime')
const path = require('path')
const url = require('url')
const urljoin = require('url-join')

const CSSHandler = require(path.join(__dirname, '/css'))
const DefaultHandler = require(path.join(__dirname, '/default'))
const ImageHandler = require(path.join(__dirname, '/image'))
const JSHandler = require(path.join(__dirname, '/js'))
const PluginHandler = require(path.join(__dirname, '/plugin'))
const Route = require(path.join(__dirname, '/../models/route'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

function parseUrl(req) {
  return url.parse(req.url, true)
}

function getFormat(req) {
  const parsedPath = parseUrl(req).pathname

  return path
    .extname(parsedPath)
    .replace('.', '')
    .toLowerCase()
}

const HandlerFactory = function() {}

HandlerFactory.prototype.create = function(req, mimetype) {
  const parsedUrl = url.parse(req.url, true)
  const pathComponents = parsedUrl.pathname.slice(1).split('/')
  const format = mimetype ? mime.getExtension(mimetype) : null

  // ensure the querystring is decoded (removes for eg &amp; entities introduced via XSLT)
  if (parsedUrl.search) {
    parsedUrl.search = he.decode(parsedUrl.search)
    req.url = url.format(parsedUrl)
  }

  // Check if a workspace file matches the first part of the path.
  const workspaceMatch = workspace.get(pathComponents[0], req.__domain)

  switch (workspaceMatch && workspaceMatch.type) {
    case 'plugins':
      return this.createFromPlugin({
        plugin: require(workspaceMatch.path),
        req
      })

    case 'recipes':
      return this.createFromRecipe({
        name: pathComponents[0],
        req,
        workspaceMatch
      })

    case 'routes':
      return this.createFromRoute({
        name: pathComponents[0],
        req,
        workspaceMatch
      })

    default:
      return this.createFromFormat({
        format,
        req
      })
  }
}

HandlerFactory.prototype.callErrorHandler = function(format, req) {
  const error = new Error('Unknown URI')

  error.statusCode = 404
  error.detail = `'${format}' is not a valid route, recipe, processor or image format`

  return Promise.reject(error)
}

HandlerFactory.prototype.createFromFormat = function({
  format,
  options,
  plugins,
  req
}) {
  const handlerData = {
    options,
    plugins
  }

  format = format || getFormat(req)

  return new Promise((resolve, reject) => {
    switch (format) {
      case 'js':
        return resolve(new JSHandler(format, req, handlerData))
      case 'css':
        return resolve(new CSSHandler(format, req, handlerData))
      case 'gif':
      case 'jpg':
      case 'jpeg':
      case 'json':
      case 'png':
      case 'webp':
        return resolve(new ImageHandler(format, req, handlerData))
      case 'bin':
        format = 'jpg'

        return resolve(new ImageHandler(format, req, handlerData))
      default:
        return resolve(new DefaultHandler(format, req, handlerData))
    }
  })
}

HandlerFactory.prototype.createFromPlugin = function({plugin, req}) {
  return Promise.resolve(new PluginHandler(req, plugin))
}

HandlerFactory.prototype.createFromRecipe = function({
  name,
  req,
  route,
  workspaceMatch
}) {
  const parsedUrl = url.parse(req.url, true)
  const source = workspaceMatch.source
  const recipeSettings = source.settings || {}

  return this.createFromFormat({
    format: recipeSettings.format,
    options: Object.assign({}, recipeSettings, parsedUrl.query),
    plugins: source.plugins,
    req
  }).then(handler => {
    // We'll remove the first part of the URL, corresponding
    // to the name of the recipe, which will leave us with the
    // path to the file.
    const filePath = parsedUrl.pathname
      .replace(new RegExp('^/' + name + '/'), '/')
      .replace(new RegExp('^/' + route + '/'), '/')

    if (typeof handler.setBaseUrl === 'function') {
      let fullPath = filePath

      // Does the recipe specify a base path?
      if (source.path) {
        // Is it a full URL?
        if (/^http(s?):\/\//.test(source.path)) {
          fullPath = urljoin(source.path, filePath)
        } else {
          // It's a relative path.
          fullPath = path.join(source.path, filePath)
        }
      }

      handler.setBaseUrl(fullPath)
    }

    return handler
  })
}

HandlerFactory.prototype.createFromRoute = function({
  name,
  req,
  workspaceMatch
}) {
  const route = new Route(workspaceMatch.source)

  route.setDomain(req.__domain)
  route.setLanguage(req.headers['accept-language'])
  route.setUserAgent(req.headers['user-agent'])

  return route.getRecipe().then(recipeName => {
    const workspaceMatch = workspace.get(recipeName, req.__domain)

    if (workspaceMatch && workspaceMatch.type === 'recipes') {
      return this.createFromRecipe({
        name: recipeName,
        req,
        route: name,
        workspaceMatch
      })
    }

    return this.callErrorHandler(name, req)
  })
}

module.exports = function() {
  return new HandlerFactory()
}

module.exports.HandlerFactory = HandlerFactory
