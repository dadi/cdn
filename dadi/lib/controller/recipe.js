const path = require('path')

const help = require(path.join(__dirname, '/../help'))
const logger = require('@dadi/logger')
const Recipe = require(path.join(__dirname, '/../models/recipe'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

module.exports.post = (req, res) => {
  let obj = typeof req.body === 'object'
    ? req.body
    : JSON.parse(req.body)

  // Don't accept an empty POST
  if (Object.keys(obj).length === 0) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  let recipe = new Recipe(obj)
  let validationErrors = recipe.validate()

  if (validationErrors) {
    return help.sendBackJSON(400, {
      success: false,
      errors: validationErrors
    }, res)
  }

  let existingWorkspaceFile = workspace.get(
    recipe.name,
    req.__domain
  )

  // Do we already have a recipe (or any other workspace file)
  // with this name?
  if (existingWorkspaceFile) {
    return help.sendBackJSON(400, {
      success: false,
      errors: [`Route ${recipe.name} already exists`]
    }, res)
  }

  return recipe.save(req.__domain).then(() => {
    return help.sendBackJSON(201, {
      success: true,
      message: `Recipe "${recipe.name}" created`
    }, res)
  }).catch(err => {
    logger.error({module: 'recipes'}, err)

    return help.sendBackJSON(400, {
      success: false,
      errors: ['Error when saving recipe']
    }, res)
  })
}
