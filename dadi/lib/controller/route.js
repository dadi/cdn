var _ = require('underscore')
var fs = require('fs')
var path = require('path')

var config = require(path.join(__dirname, '/../../../config'))
var help = require(path.join(__dirname, '/../help'))
var Route = require(path.join(__dirname, '/../models/route'))

function routeExists (route) {
  var routePath = path.join(path.resolve(config.get('paths.routes')), route + '.json')

  return new Promise((resolve, reject) => {
    fs.stat(routePath, (err, stats) => {
      return resolve(!err && stats.isFile())
    })
  })
}

module.exports.post = (req, res) => {
  var route = new Route(req.body)
  var validationErrors = route.validate()

  // Don't accept an empty POST
  if (_.isEmpty(req.body)) {
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

  return routeExists(req.body.route).then((routeExists) => {
    if (routeExists) {
      return help.sendBackJSON(400, {
        success: false,
        errors: ['Route already exists']
      }, res)
    }

    if (route.save()) {
      return help.sendBackJSON(200, {
        success: true
      }, res)
    } else {
      return help.sendBackJSON(400, {
        success: false,
        errors: ['Error when saving route']
      }, res)
    }
  })
}
