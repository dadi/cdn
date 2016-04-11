var nodeUrl = require('url');
var _ = require('underscore');
var S3Storage = require(__dirname + '/s3');
var DiskStorage = require(__dirname + '/disk');
var HTTPStorage = require(__dirname + '/http');

var config = require(__dirname + '/../../../config');

module.exports = {
  create: function create(type, url) {
    var configBlock;

    // set a default version
    var version = 'v1'

    // set version 2 if the url was supplied with a querystring
    if (require('url').parse(url, true).search) {
      version = 'v2'
    }

    if (type === 'image') {
      configBlock = config.get('images')
    }
    else if (type === 'asset') {
      configBlock = config.get('assets')
    }

    // get storage adapter from the configuration settings
    if (version === 'v1') {
      adapterKey = _.compact(_.map(configBlock, function(storage, key) {
        if (storage.enabled) {
          if (key === 'directory') return 'disk'
          if (key === 'remote') return 'http'
          if (key === 's3') return 's3'
          return key;
        }
      }))

      if (_.isArray(adapterKey)) adapterKey = adapterKey[0]

      if (type === 'image') {
        if (url.split('/').length > 15) url = url.split('/').slice(18).join('/')
      }

      if (type === 'asset') url = url;//.split('/').slice(3).join('/')

      // console.log(url)
      // console.log(type)
    }

    // get storage adapter from the first part of the url
    if (version === 'v2') {
      adapterKey = _.compact(url.split('/')).shift()
      url = nodeUrl.parse(url, true).pathname
    }

    switch (adapterKey) {
      case 'disk':
        return new DiskStorage(configBlock, url)
        break
      case 'http':
        return new HTTPStorage(configBlock, url)
        break
      case 's3':
        return new S3Storage(configBlock, url)
        break
      default:
        return new DiskStorage(configBlock, url)
        break
    }
  }
}
