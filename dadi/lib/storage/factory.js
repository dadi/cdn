var _ = require('underscore')
var nodeUrl = require('url')
var path = require('path')
var S3Storage = require(path.join(__dirname, '/s3'))
var DiskStorage = require(path.join(__dirname, '/disk'))
var HTTPStorage = require(path.join(__dirname, '/http'))

var config = require(path.join(__dirname, '/../../../config'))

module.exports = {
  create: function create (type, url, hasQuery) {
    var configBlock

    // set a default version
    var version = 'v1'

    // set version 2 if the url was supplied with a querystring
    if (hasQuery || require('url').parse(url, true).search) {
      version = 'v2'
    }

    if (type === 'image') {
      configBlock = config.get('images')
    } else if (type === 'asset') {
      configBlock = config.get('assets')
    }

    if (version === 'v1') {
      if (type === 'image') {
        var parsedUrl = nodeUrl.parse(url, true)

        // get the segments of the url that relate to image manipulation options
        var urlSegments = _.filter(parsedUrl.pathname.split('/'), function (segment, index) {
          if (index > 0 && segment === '') return '0'
          if (index < 13 || (index >= 13 && /^[0-1]$/.test(segment))) {
            return segment
          }
        })

        url = parsedUrl.pathname.replace(urlSegments.join('/') + '/', '')
      }

      // for version 1 assets we need the part of the url following
      // either "/fonts/" or "/css/0/" or "/js/1/"
      if (type === 'asset') {
        var re = /\/(css|js)\/[0-9]\//gi
        url = url.replace(re, '')
        var fontsre = /\/fonts\/[0-9]\//gi
        url = url.replace(fontsre, '')
      }
    }

    var adapterKey

    // get storage adapter from the first part of the url
    if (version === 'v2') {
      adapterKey = _.compact(url.split('/')).shift()
      url = nodeUrl.parse(url, true).pathname
    }

    // get storage adapter from the configuration settings
    if (version === 'v1' || /(disk|http|s3)/.exec(adapterKey) === null) {
      adapterKey = _.compact(_.map(configBlock, function (storage, key) {
        if (storage.enabled) {
          if (key === 'directory') return 'disk'
          if (key === 'remote') return 'http'
          if (key === 's3') return 's3'
          return key
        }
      }))

      if (_.isArray(adapterKey)) adapterKey = adapterKey[0]
    }

    switch (adapterKey) {
      case 'disk':
        return new DiskStorage(configBlock, url)
      case 'http':
        return new HTTPStorage(configBlock, url)
      case 's3':
        return new S3Storage(configBlock, url)
      default:
        return new DiskStorage(configBlock, url)
    }
  }
}
