const path = require('path')
const help = require(path.join(__dirname, '/../help'))
const logger = require('@dadi/logger')
const Route = require(path.join(__dirname, '/../models/route'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

module.exports.post = (req, res) => {
  const route = new Route(req.body)
  const validationErrors = route.validate()

  // Don't accept an empty POST
  if (!req.body || (Object.keys(req.body).length === 0)) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  if (validationErrors) {
    return help.sendBackJSON(400, {
      success: false,
      errors: validationErrors
    }, res)
  }

  if (workspace.get(route.config.route, req.__domain)) {
    return help.sendBackJSON(400, {
      success: false,
      errors: [`Route '${route.config.route}' already exists`]
    }, res)
  }

  return route.save(req.__domain).then(() => {
    return help.sendBackJSON(200, {
      success: true
    }, res)
  }).catch(err => {
    logger.error({module: 'routes'}, err)

    return help.sendBackJSON(400, {
      success: false,
      errors: ['Error when saving route']
    }, res)
  })
}
