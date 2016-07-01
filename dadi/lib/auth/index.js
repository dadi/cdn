var url = require('url')
var _ = require('underscore')
var persist = require('node-persist')
var uuid = require('node-uuid')

var config = require(__dirname + '/../../../config.js')
var help = require(__dirname + '/../help')

function mustAuthenticate (requestUrl) {
  // all /api requests must be authenticated
  return requestUrl.indexOf('/api') === 0
}

// This attaches middleware to the passed in app instance
module.exports = function (router) {
  persist.initSync()
  if (!persist.getItem('token')) {
    persist.setItemSync('token', [])
  }

  var tokenRoute = '/token'

  // Authorize
  router.use(function (req, res, next) {

    // Let requests for tokens through, along with endpoints configured to not use authentication
    if (req.url === tokenRoute || !mustAuthenticate(req.url)) return next()

    // require an authorization header for every request
    if (!(req.headers && req.headers.authorization)) {
      return fail('NoToken', res)
    }

    // Strip token value out of request headers
    var parts = req.headers.authorization.split(' ')
    var token

    // Headers should be `Authorization: Bearer <%=tokenvalue%>`
    if (parts.length == 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1]
    }

    if (!token) {
      return fail('NoToken', res)
    }

    var token_list = persist.getItem('token')
    if (token_list.length > 0) {
      var existToken = 0
      for (var i = 0; i < token_list.length; i++) {
        var local_token_item = token_list[i]
        if (token == local_token_item.token && parseInt(local_token_item.tokenExpire) >= Date.now()) {
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

  // Setup token service
  router.use(tokenRoute, function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    if (method === 'post') {
      var clientId = req.body.clientId
      var secret = req.body.secret
      if (clientId == config.get('auth.clientId') && secret == config.get('auth.secret')) {
        var token = uuid.v4()
        var token_list = persist.getItem('token')
        token_list.push({token: token, tokenExpire: Date.now() + (config.get('auth.tokenTtl') * 1000)})
        persist.setItemSync('token', token_list)

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')
        res.end(JSON.stringify({
          accessToken: token,
          tokenType: 'Bearer',
          expiresIn: config.get('auth.tokenTtl')
        }))
      } else {
        return fail('NoAccess', res)
      }
    }
    next()
  })

  function fail(type, res) {
    switch (type) {
      case 'NoToken':
        res.setHeader('WWW-Authenticate', 'Bearer, error="no_token", error_description="No access token supplied"')
        break
      case 'InvalidToken':
        res.setHeader('WWW-Authenticate', 'Bearer, error="invalid_token", error_description="Invalid or expired access token"')
        break
      default:
        res.setHeader('WWW-Authenticate', 'Bearer realm="/token"');
    }

    return help.displayUnauthorizedError(res)
  }
}
