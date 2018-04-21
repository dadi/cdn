const jwt = require('jsonwebtoken')
const logger = require('@dadi/logger')
const path = require('path')

const config = require(path.join(__dirname, '/../../../config.js'))
const help = require(path.join(__dirname, '/../help'))

function mustAuthenticate (requestUrl) {
  // All /api requests must be authenticated.
  return requestUrl.indexOf('/api') === 0
}

// This attaches middleware to the passed in app instance
module.exports = function (router) {
  let tokenRoute = '/token'

  // Authorize
  router.use((req, res, next) => {
    // Let requests for tokens through, along with endpoints configured
    // to not use authentication.
    if (req.url === tokenRoute || !mustAuthenticate(req.url)) {
      return next()
    }

    // Require an authorization header for every request.
    if (!(req.headers && req.headers.authorization)) {
      return fail('NoToken', res)
    }

    // Strip token value out of request headers.
    let parts = req.headers.authorization.split(' ')

    // Headers should be `Authorization: Bearer <%=tokenvalue%>`
    let token = (parts.length === 2 && /^Bearer$/i.test(parts[0]))
      ? parts[1]
      : null

    if (!token) {
      return fail('NoToken', res)
    }

    jwt.verify(token, config.get('auth.privateKey'), (err, decoded) => {
      if (err || (decoded.domain !== req.__domain)) {
        return fail('InvalidToken', res)
      }

      return next()
    })
  })

  // Setup token service.
  router.use(tokenRoute, (req, res, next) => {
    let method = req.method && req.method.toLowerCase()

    if (method !== 'post') {
      return next()
    }

    let clientId = req.body.clientId
    let secret = req.body.secret

    if (
      clientId !== config.get('auth.clientId') ||
      secret !== config.get('auth.secret')
    ) {
      return fail('NoAccess', res)
    }

    let payload = {
      domain: req.__domain
    }

    // Sign a JWT token.
    jwt.sign(payload, config.get('auth.privateKey'), {
      expiresIn: config.get('auth.tokenTtl')
    }, (err, token) => {
      if (err) {
        logger.error({module: 'auth'}, err)

        return fail('JWTError', res)
      }

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')
      res.end(JSON.stringify({
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: config.get('auth.tokenTtl')
      }))
    })
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
