const domainManager = require('./domain-manager')
const fs = require('fs-extra')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

const Recipe = function (content) {
  this.recipe = content
  this.name = this.recipe.recipe
}

Recipe.prototype.save = function (domainName) {
  let domain = domainManager.getDomain(domainName)
  let recipePath = path.resolve(
    path.join(
      domain ? domain.path : '',
      config.get('paths.recipes', domainName),
      `${this.name}.json`
    )
  )

  return fs.writeJson(recipePath, this.recipe, {
    spaces: 2
  })
}

Recipe.prototype.validate = function () {
  let required = ['recipe', 'settings']
  let errors = []

  for (var key in required) {
    if (!this.recipe.hasOwnProperty(required[key])) {
      errors.push({
        error: `Property "${required[key]}" not found in recipe`
      })
    }
  }

  // Validate name pattern.
  if (/^[A-Za-z-_]{5,}$/.test(this.recipe.recipe) === false) {
    errors.push({
      error: 'Recipe name must be 5 characters or longer and contain only uppercase and lowercase letters, dashes and underscores'
    })
  }

  return errors.length ? errors : null
}

module.exports = Recipe
