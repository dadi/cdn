var fs = require('fs')
var logger = require('@dadi/logger')
var path = require('path')
var config = require(path.join(__dirname, '/../../../config'))

var Recipe = function (content) {
  this.recipe = content
  this.name = this.recipe.recipe
}

Recipe.prototype.save = function () {
  var recipePath = path.join(config.get('paths.recipes'), this.name) + '.json'

  try {
    fs.writeFileSync(recipePath, JSON.stringify(this.recipe, null, 2))

    return true
  } catch (err) {
    logger.error({module: 'recipes'}, err)

    return false
  }
}

Recipe.prototype.validate = function () {
  var required = ['recipe', 'path', 'settings']
  var errors = []

  for (var key in required) {
    if (!this.recipe.hasOwnProperty(required[key])) {
      errors.push({ error: `Property "${required[key]}" not found in recipe` })
    }
  }

  // validate name pattern
  if (/^[A-Za-z-_]{5,}$/.test(this.recipe.recipe) === false) {
    errors.push({ error: 'Recipe name must be 5 characters or longer and contain only uppercase and lowercase letters, dashes and underscores' })
  }

  return errors.length ? errors : null
}

module.exports = Recipe
