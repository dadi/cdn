var _ = require('underscore')
var fs = require('fs')
var mkdirp = require('mkdirp')
var nodeUrl = require('url')
var path = require('path')
var querystring = require('querystring')
var sha1 = require('sha1')
var urljoin = require('url-join')
var wget = require('@dadi/wget')

// var Missing = require(path.join(__dirname, '/missing'))

var tmpDirectory = path.resolve(path.join(__dirname, '/../../../workspace/_tmp'))
console.log(tmpDirectory)
mkdirp(tmpDirectory, (err, made) => {
  console.log(made)
  if (err) {
    console.log(err)
  }
})

var HTTPStorage = function (settings, url) {
  if (settings && !settings.remote.path) throw new Error('Remote address not specified')

  this.url = url

  if (settings) {
    this.baseUrl = settings.remote.path
  }
}

HTTPStorage.prototype.getFullUrl = function () {
  if (this.baseUrl) {
    return urljoin(this.baseUrl, this.url.replace('/http/', ''))
  } else {
    return this.url
  }
}

HTTPStorage.prototype.get = function () {
  return new Promise((resolve, reject) => {
    this.tmpFile = path.join(tmpDirectory, sha1(this.url) + '-' + Date.now() + path.extname(this.url))

    var options = {
      headers: {
        'User-Agent': 'DADI CDN'
      }
    }

    var download = wget.download(this.getFullUrl(), this.tmpFile, options)

    download.on('error', (error) => {
      var err = {}

      if (typeof error === 'string') {
        if (error.indexOf('404') > -1) {
          err.statusCode = '404'
          err.message = 'Not Found: ' + this.getFullUrl()
        } else if (error.indexOf('403') > -1) {
          err.statusCode = '403'
          err.message = 'Forbidden: ' + this.getFullUrl()
        }

        return reject(err)
      } else {
        return reject(error)
      }
    })

    // download.on('start', function (fileSize) { })

    download.on('end', (output) => {
      return resolve(fs.createReadStream(this.tmpFile))
    })

    // download.on('progress', function (progress) {
      // console.log(Math.ceil(progress * 100) + '%')
    // })

    // if (err.statusCode === 404) {
    //   return new Missing().get().then((stream) => {
    //     this.notFound = true
    //     this.lastModified = new Date()
    //     return resolve(stream)
    //   }).catch((e) => {
    //     return reject(e)
    //   })
    // }
  })
}

/**
 * Removes the temporary file downloaded from the remote server
 */
HTTPStorage.prototype.cleanUp = function () {
  try {
    fs.unlinkSync(this.tmpFile)
  } catch (err) {
    console.log(err)
  }
}

module.exports = function (settings, url) {
  return new HTTPStorage(settings, url)
}

module.exports.HTTPStorage = HTTPStorage

module.exports.processURL = function (url, imageOptions) {
  var parsedUrl = nodeUrl.parse(url, true)
  var returnUrl = parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname

  var querystrings = parsedUrl.search.split('?').reverse()
  var imageOptionsAndAliases = _.flatten(_.union(_.pluck(imageOptions, 'name'), _.pluck(imageOptions, 'aliases')))

  var qs = querystrings[0]
  var params = querystring.decode(qs)

  if (_.every(Object.keys(params), (key) => { return _.contains(imageOptionsAndAliases, key) })) {
    delete querystrings[0]
  }

  querystrings = _.compact(querystrings).reverse()

  _.each(querystrings, (qs) => {
    returnUrl += '?' + qs
  })

  return returnUrl
}
