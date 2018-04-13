'use strict'

const he = require('he')
const logger = require('@dadi/logger')
const mime = require('mime')
const path = require('path')
const url = require('url')

const CSSHandler = require(path.join(__dirname, '/css'))
const DefaultHandler = require(path.join(__dirname, '/default'))
const ImageHandler = require(path.join(__dirname, '/image'))
const JSHandler = require(path.join(__dirname, '/js'))
const PluginHandler = require(path.join(__dirname, '/plugin'))
const Route = require(path.join(__dirname, '/../models/route'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

function parseUrl (req) {
  return url.parse(req.url, true)
}

function getFormat (req) {
  let parsedPath = parseUrl(req).pathname

  // add default jpg extension
  if (path.extname(parsedPath) === '') {
    parsedPath += '.jpg'
  }

  if (req.__cdnLegacyURLSyntax) {
    return parsedPath.split('/').find(Boolean)
  }

  return path.extname(parsedPath).replace('.', '').toLowerCase()
}

const HandlerFactory = function () {}

HandlerFactory.prototype.create = function (req, mimetype) {
  const parsedUrl = url.parse(req.url, true)
  const pathComponents = parsedUrl.pathname.slice(1).split('/')

  let format = mimetype ? mime.extension(mimetype) : null

  // version 1 matches a string like /jpg/80/0/0/640/480/ at the beginning of the url pathname
  const v1pattern = /^\/[a-z]{3,4}\/[0-9]+\/[0-1]+\/[0-1]+\/[0-9]+\/[0-9]+\//gi

  if (v1pattern.test(parsedUrl.pathname) || /\/(fonts|css|js)/.test(pathComponents[0])) {
    req.__cdnLegacyURLSyntax = true

    logger.warn(
      `'${parsedUrl.pathname}': this request uses a deprecated URL format which will be removed from future versions of DADI CDN. For more information, please visit https://docs.dadi.tech/cdn#querystring-url-scheme.`
    )
  } else {
    // ensure the querystring is decoded (removes for eg &amp; entities introduced via XSLT)
    if (parsedUrl.search) {
      parsedUrl.search = he.decode(parsedUrl.search)
      req.url = url.format(parsedUrl)
    }
  }

  // Create an image handler if the request uses a legacy URL.
  if (req.__cdnLegacyURLSyntax) {
    return this.createFromFormat({
      format,
      req
    })
  } else {
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
}

HandlerFactory.prototype.callErrorHandler = function (format, req) {
  const error = new Error('Unknown URI')

  error.statusCode = 404
  error.detail = `'${format}' is not a valid route, recipe, processor or image format`

  return Promise.reject(error)
}

HandlerFactory.prototype.createFromFormat = function ({format, options, plugins, req}) {
  let handlerData = {
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

HandlerFactory.prototype.createFromPlugin = function ({plugin, req}) {
  return Promise.resolve(new PluginHandler(req, plugin))
}

HandlerFactory.prototype.createFromRecipe = function ({name, req, route, workspaceMatch}) {
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

    // Does the recipe specify a base path?
    const fullPath = source.path
      ? path.join(source.path, filePath)
      : filePath

    if (typeof handler.setBaseUrl === 'function') {
      handler.setBaseUrl(fullPath)
    }

    return handler
  })
}

HandlerFactory.prototype.createFromRoute = function ({name, req, workspaceMatch}) {
  const route = new Route(workspaceMatch.source)

  route.setLanguage(req.headers['accept-language'])
  route.setUserAgent(req.headers['user-agent'])

  return route.getRecipe().then(recipeName => {
    let workspaceMatch = workspace.get(recipeName, req.__domain)

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

module.exports = function () {
  return new HandlerFactory()
}

module.exports.HandlerFactory = HandlerFactory
