const path = require('path')
const config = require(path.resolve(path.join(__dirname, '/../../config')))
const cache = require(path.join(__dirname, '/cache'))

module.exports.clearCache = function (pathname, callback) {
  cache().delete(pathname, (err) => {
    if (err) console.log(err)
    return callback(null)
  })
}

// helper that sends json response
module.exports.sendBackJSON = function (successCode, results, res) {
  res.statusCode = successCode

  let resBody = JSON.stringify(results)

  if (results instanceof Error && resBody === '{}') {
    resBody = JSON.stringify({ message: results.message || 'unknown error' })
    res.statusCode = results.statusCode || res.statusCode
  }

  res.setHeader('Server', config.get('server.name'))
  res.setHeader('Content-Type', 'application/json')
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
