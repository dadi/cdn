const fs = require('fs')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

/*
  The following tree:

  recipes/
  |_ foo.json
  routes/
  |_ bar.json

  ... results in an object like:

  {
    "foo": {
      "path": "/cdn/directory/recipes/foo.json",
      "type": "recipes"
    },
    "bar": {
      "path": "/cdn/directory/routes/bar.json",
      "type": "routes"
    }
  }
*/
const Workspace = function () {
  this.VALID_EXTENSIONS = ['.js', '.json']
  this.workspace = {}
}

/**
 * Builds a workspace tree and updates the internal reference.
 *
 * @return {Object} The new workspace
 */
Workspace.prototype.build = function () {
  this.workspace = this.read()

  return this.workspace
}

/**
 * Returns an item in the workspace, if the `item` argument
 * is defined. Otherwise, returns the entire workspace tree.
 *
 * @param  {String} item
 * @return {Object}
 */
Workspace.prototype.get = function (item) {
  if (item !== undefined) {
    return this.workspace[item]
  }

  return this.workspace
}

/**
 * Creates an object with all the files existing in the various
 * workspace directories.
 *
 * @return {Object}
 */
Workspace.prototype.read = function () {
  const directories = {
    plugins: fs.readdirSync(path.resolve(config.get('paths.plugins'))),
    processors: fs.readdirSync(path.resolve(config.get('paths.processors'))),
    recipes: fs.readdirSync(path.resolve(config.get('paths.recipes'))),
    routes: fs.readdirSync(path.resolve(config.get('paths.routes')))
  }

  return Object.keys(directories).reduce((files, type) => {
    directories[type].forEach(file => {
      const extension = path.extname(file)
      const baseName = path.basename(file, extension)
      const fullPath = path.resolve(config.get(`paths.${type}`), file)

      if (!this.VALID_EXTENSIONS.includes(extension)) return

      let source
      let workspaceKey = baseName

      if (extension === '.json') {
        delete require.cache[fullPath]

        source = require(fullPath)
      }

      if (type === 'recipes') {
        workspaceKey = source.recipe || workspaceKey
      } else if (type === 'routes') {
        workspaceKey = source.route || workspaceKey
      }

      if (files[workspaceKey] !== undefined) {
        throw new Error(`Naming conflict: ${workspaceKey} exists in both '${files[workspaceKey].path}' and '${fullPath}'`)
      }

      files[workspaceKey] = {
        path: fullPath,
        source: source,
        type
      }
    })

    return files
  }, {})
}

module.exports = new Workspace()
module.exports.factory = () => new Workspace()
