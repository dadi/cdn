const domainManager = require('./domain-manager')
const fs = require('fs-extra')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

const Recipe = function(content) {
  this.recipe = content
  this.name = this.recipe.recipe
}

Recipe.prototype.save = function(domainName) {
  const domain = domainManager.getDomain(domainName)
  const recipePath = path.resolve(
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

Recipe.prototype.validate = function() {
  const required = ['recipe', 'settings']
  const errors = []

  for (const key in required) {
    if (this.recipe[required[key]] === undefined) {
      errors.push({
        error: `Property "${required[key]}" not found in recipe`
      })
    }
  }

  // Validate name pattern.
  if (/^[A-Za-z-_]{5,}$/.test(this.recipe.recipe) === false) {
    errors.push({
      error:
        'Recipe name must be 5 characters or longer and contain only uppercase and lowercase letters, dashes and underscores'
    })
  }

  return errors.length ? errors : null
}

module.exports = Recipe
