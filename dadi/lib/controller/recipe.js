var _ = require('underscore')
var fs = require('fs')
var path = require('path')

var config = require(path.join(__dirname, '/../../../config'))
var help = require(path.join(__dirname, '/../help'))
var Recipe = require(path.join(__dirname, '/../models/recipe'))

function recipeExists (recipe) {
  var recipePath = path.join(path.resolve(config.get('paths.recipes')), recipe.name + '.json')

  return new Promise((resolve, reject) => {
    fs.stat(recipePath, (err, stats) => {
      return resolve(!err && stats.isFile())
    })
  })
}

module.exports.post = (req, res) => {
  // Don't accept an empty POST
  if (_.isEmpty(req.body)) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  // Valid JSON?
  try {
    var obj = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
  } catch (err) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Invalid JSON Syntax']
    }, res)
  }

  var recipe = new Recipe(obj)
  var validationErrors = recipe.validate()

  if (validationErrors) {
    return help.sendBackJSON(400, {
      success: false,
      errors: validationErrors
    }, res)
  }

  return recipeExists(recipe).then((exists) => {
    // if (exists) {
    //   return help.sendBackJSON(400, {
    //     success: false,
    //     errors: ['Recipe already exists']
    //   }, res)
    // }

    if (recipe.save()) {
      return help.sendBackJSON(201, {
        success: true,
        message: `Recipe "${recipe.name}" created`
      }, res)
    } else {
      return help.sendBackJSON(400, {
        success: false,
        errors: ['Error when saving recipe']
      }, res)
    }
  })
}
