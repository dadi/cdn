var path = require('path')
var persist = require('node-persist')
var uuid = require('uuid')

var config = require(path.join(__dirname, '/../../../config.js'))
var help = require(path.join(__dirname, '/../help'))

function mustAuthenticate (requestUrl) {
  if (requestUrl.indexOf('/api/upload') > -1 && config.get('upload.requireAuthentication') === false) {
    return false
  }

  // all /api requests must be authenticated
  return requestUrl.indexOf('/api') === 0
}

// This attaches middleware to the passed in app instance
module.exports = function (router) {
  persist.initSync()

  persist.getItem('token').then((tokenList) => {
    if (!tokenList) {
      persist.setItemSync('token', [])
    }
  })

  var tokenRoute = '/token'

  // Authorize
  router.use(function (req, res, next) {
    // Let requests for tokens through, along with endpoints configured to not use authentication
    if (req.url === tokenRoute) return next()
    if (!mustAuthenticate(req.url)) return next()

    // require an authorization header for every request
    if (!(req.headers && req.headers.authorization)) {
      return fail('NoToken', res)
    }

    // Strip token value out of request headers
    var parts = req.headers.authorization.split(' ')
    var token

    // Headers should be `Authorization: Bearer <%=tokenvalue%>`
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1]
    }

    if (!token) {
      return fail('NoToken', res)
    }

    persist.getItem('token').then((tokenList) => {
      if (tokenList.length > 0) {
        var existToken = 0
        for (var i = 0; i < tokenList.length; i++) {
          var localToken = tokenList[i]
          if (token === localToken.token && parseInt(localToken.tokenExpire) >= Date.now()) {
            existToken++
          }
        }

        if (existToken > 0) {
          return next()
        } else {
          return fail('InvalidToken', res)
        }
      } else {
        return fail('NoToken', res)
      }
    })
  })

  // Setup token service
  router.use(tokenRoute, function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    if (method === 'post') {
      var clientId = req.body.clientId
      var secret = req.body.secret

      if (clientId === config.get('auth.clientId') && secret === config.get('auth.secret')) {
        var token = uuid.v4()

        persist.getItem('token').then((tokenList) => {
          tokenList.push({token: token, tokenExpire: Date.now() + (config.get('auth.tokenTtl') * 1000)})
          persist.setItemSync('token', tokenList)

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Pragma', 'no-cache')
          res.end(JSON.stringify({
            accessToken: token,
            tokenType: 'Bearer',
            expiresIn: config.get('auth.tokenTtl')
          }))
        })
      } else {
        return fail('NoAccess', res)
      }
    } else {
      next()
    }
  })

  function fail (type, res) {
    switch (type) {
      case 'NoToken':
        res.setHeader('WWW-Authenticate', 'Bearer, error="no_token", error_description="No access token supplied"')
        break
      case 'InvalidToken':
        res.setHeader('WWW-Authenticate', 'Bearer, error="invalid_token", error_description="Invalid or expired access token"')
        break
      default:
        res.setHeader('WWW-Authenticate', 'Bearer realm="/token"')
    }

    return help.displayUnauthorizedError(res)
  }
}
