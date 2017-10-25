var path = require('path')
var streamLength = require('stream-length')

var config = require(path.resolve(path.join(__dirname, '/../../config')))
var cache = require(path.join(__dirname, '/cache'))

module.exports.contentLength = function (stream) {
  return new Promise(function (resolve, reject) {
    Promise.try(function () {
      return streamLength(stream)
    })
      .then(function (result) {
        resolve(result)
      })
      .catch(function (err) {
        reject(err)
      })
  })
}

// helper that sends json response
module.exports.sendBackJSON = function (successCode, results, res) {
  res.statusCode = successCode

  var resBody = JSON.stringify(results)
  if (results instanceof Error && resBody === '{}') {
    resBody = JSON.stringify({ message: results.message || 'unknown error' })
  }

  res.setHeader('Server', config.get('server.name'))
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(resBody))
  res.end(resBody)
}

module.exports.sendBackJSONP = function (callbackName, results, res) {
  // callback MUST be made up of letters only
  if (!callbackName.match(/^[a-zA-Z]+$/)) return res.send(400)

  res.statusCode = 200

  var resBody = JSON.stringify(results)
  resBody = callbackName + '(' + resBody + ');'

  res.setHeader('Server', config.get('server.name'))
  res.setHeader('Content-Type', 'text/javascript')
  res.setHeader('Content-Length', Buffer.byteLength(resBody))
  res.end(resBody)
}

/**
 * Display Unauthorized Error
 */
module.exports.displayUnauthorizedError = function (res) {
  res.statusCode = 401
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Expires', '-1')

  var errorMsg = {
    Error: 'HTTP 401 Unauthorized'
  }

  res.end(JSON.stringify(errorMsg))
}

module.exports.clearCache = function (pathname, callback) {
  cache.delete(pathname, function (err) {
    if (err) console.log(err)
    return callback(null)
  })
}
