var fs = require('fs')
var path = require('path')
var Promise = require('bluebird')
var url = require('url')
var _ = require('underscore')
var AssetHandler = require(__dirname + '/asset')
var ImageHandler = require(__dirname + '/image')

var config = require(__dirname + '/../../../config')

function parseUrl (req) {
  return url.parse(req.url, true)
}

function getFormat (version, req) {
  var parsedPath = parseUrl(req).pathname

  if (version === 'v1') {
    return _.compact(parsedPath.split('/'))[0]
  }
  else if (version === 'v2') {
    return path.extname(parsedPath).replace('.', '')
  }
}

var HandlerFactory = function () {}

HandlerFactory.prototype.create = function (req) {
  var self = this

  // set a default version
  var version = 'v1'

  // set version 2 if the url was supplied with a querystring
  if (require('url').parse(req.url, true).search) {
    version = 'v2'
  }

  return new Promise(function (resolve, reject) {
    var format = getFormat(version, req)

    self.createFromFormat(format, req).then(function (handler) {
      return resolve(handler)
    }).catch(function (err) {
      return reject(err)
    })
  })
}

HandlerFactory.prototype.createFromFormat = function (format, req) {
  var self = this

  return new Promise(function (resolve, reject) {
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
        break
      case 'gif':
      case 'jpg':
      case 'json':
      case 'png':
        return resolve(new ImageHandler(format, req))
        break
      default:
        self.createFromRecipe(format, req).then(function (handler) {
          return resolve(handler)
        }).catch(function (err) {
          return reject(err)
        })
        break
    }
  })
}

HandlerFactory.prototype.createFromRecipe = function (format, req) {
  var self = this

  return new Promise(function (resolve, reject) {
    var recipePath = path.join(path.resolve(config.get('paths.recipes')), format + '.json')

    fs.stat(recipePath, function (err, stats) {
      if (err) {
        if (err.code === 'ENOENT') {
          var err = {
            statusCode: 404,
            message: `Unknown recipe "${format}.json"`
          }

          return reject(err)
        }
        return reject(err)
      }

      var recipe = require(recipePath)

      self.createFromFormat(recipe.settings.format, req).then(function (handler) {
        var referencePath = recipe.path ? recipe.path : ''
        var filePath = parseUrl(req).pathname.replace(format, '')
        var fullPath = path.join(referencePath, filePath)

        handler.url = fullPath
        handler.fileName = path.basename(parseUrl(req).pathname.replace(format, ''))
        handler.fileExt = path.extname(parseUrl(req).pathname).replace('.', '')
        handler.compress = recipe.settings.compress ? recipe.settings.compress.toString() : '0'
        handler.options = recipe.settings

        return resolve(handler)
      }).catch(function (err) {
        return reject(err)
      })
    })
  })
}

module.exports = function () {
  return new HandlerFactory()
}

module.exports.HandlerFactory = HandlerFactory
