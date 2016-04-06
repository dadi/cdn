var _ = require('underscore');
var S3Storage = require(__dirname + '/s3');
var DiskStorage = require(__dirname + '/disk');
var HTTPStorage = require(__dirname + '/http');

var config = require(__dirname + '/../config');

module.exports = {
  create: function create(req) {
    // set a default adapter
    var adapterKey = 'disk'

    // set a default version
    var version = 'v1'

    // get version from the request header if supplied
    var versionRegex = /vnd.dadicdn-(.*)\+json/
    if (req.headers.hasOwnProperty('accept')) {
      if ((m = versionRegex.exec(req.headers.accept)) !== null) {
        version = m[1]
      }
    }

    // get storage adapter from the configuration settings
    if (version === 'v1') {
      adapterKey = _.compact(_.map(config.get('images'), function(block, key) {
        if (block.enabled) {
          if (key === 'directory') return 'disk'
          if (key === 'remote') return 'http'
          return key;
        }
      }))

      if (_.isArray(adapterKey)) adapterKey = adapterKey[0]
    }

    // get storage adapter from the first part of the url
    if (version === 'v2') adapterKey = _.compact(req.url.split('/')).shift()

    switch (adapterKey) {
      case 'disk':
        return new DiskStorage(req.url)
        break
      case 'remote':
        return new HTTPStorage(req.url)
        break
      case 's3':
        return new S3Storage(req.url)
        break
      default:
        return new DiskStorage(req.url)
        break
    }
  }
}
