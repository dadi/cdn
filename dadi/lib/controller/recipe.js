const path = require('path')

const help = require(path.join(__dirname, '/../help'))
const Recipe = require(path.join(__dirname, '/../models/recipe'))
const workspace = require(path.join(__dirname, '/../models/workspace'))

module.exports.post = (req, res) => {
  // Don't accept an empty POST
  if (Object.keys(req.body).length === 0) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Bad Request']
    }, res)
  }

  let obj

  // Valid JSON?
  try {
    obj = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
  } catch (err) {
    return help.sendBackJSON(400, {
      success: false,
      errors: ['Invalid JSON Syntax']
    }, res)
  }

  const recipe = new Recipe(obj)
  const validationErrors = recipe.validate()

  if (validationErrors) {
    return help.sendBackJSON(400, {
      success: false,
      errors: validationErrors
    }, res)
  }

  const existingWorkspaceFile = workspace.get(recipe.name)

  // Do we already have a recipe (or any other workspace file)
  // with this name?
  if (existingWorkspaceFile) {
    return help.sendBackJSON(400, {
      success: false,
      errors: [`Route ${recipe.name} already exists`]
    }, res)
  }

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
}
