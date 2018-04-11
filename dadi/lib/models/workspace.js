const fs = require('fs-extra')
const logger = require('@dadi/logger')
// const mkdirp = require('mkdirp')
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
 * Ensures that all workspace directories exist, creating any that
 * are missing.
 *
 * @return {Array<String>} list of directories created
 */
Workspace.prototype.createDirectories = function () {
  let directories = [
    path.resolve(config.get('paths.plugins')),
    path.resolve(config.get('paths.recipes')),
    path.resolve(config.get('paths.routes'))
  ]

  // Adding domain-specific workspace directories.
  if (config.get('multiDomain.enabled')) {
    let domainsDirectory = path.resolve(config.get('multiDomain.directory'))

    fs.readdirSync(domainsDirectory).forEach(domain => {
      let stats = fs.statSync(path.join(domainsDirectory, domain))

      if (stats.isDirectory()) {
        directories.push(
          path.resolve(
            domainsDirectory,
            domain,
            config.get('paths.plugins', domain)
          )
        )

        directories.push(
          path.resolve(
            domainsDirectory,
            domain,
            config.get('paths.recipes', domain)
          )
        )

        directories.push(
          path.resolve(
            domainsDirectory,
            domain,
            config.get('paths.routes', domain)
          )
        )
      }
    })
  }

  let createDirectories = directories.reduce((directories, directory) => {
    let result = fs.ensureDirSync(directory)

    if (result) {
      logger.info({module: 'workspace'}, `Created directory: '${directory}'`)

      directories.push(directory)
    }

    return directories
  }, [])

  return createDirectories

  // let createDirectories = directories.reduce((directories, directory) => {
  //   let result = mkdirp.sync(directory)

  //   if (result) {
  //     logger.info({module: 'workspace'}, `Created directory: '${directory}'`)

  //     directories.push(directory)
  //   }

  //   return directories
  // }, [])

  // return createDirectories
}

/**
 * Returns an item in the workspace, if the `item` argument
 * is defined. Otherwise, returns the entire workspace tree.
 *
 * @param  {String} item
 * @return {Object}
 */
Workspace.prototype.get = function (item, domain) {
  if (item !== undefined) {
    let key = domain ? `${domain}:${item}` : item

    return this.workspace[key]
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
  let directories = [
    {
      items: fs.readdirSync(path.resolve(config.get('paths.plugins'))),
      type: 'plugins'
    },
    {
      items: fs.readdirSync(path.resolve(config.get('paths.recipes'))),
      type: 'recipes'
    },
    {
      items: fs.readdirSync(path.resolve(config.get('paths.routes'))),
      type: 'routes'
    }
  ]

  // Adding domain-specific workspace directories.
  if (config.get('multiDomain.enabled')) {
    let domainsDirectory = path.resolve(config.get('multiDomain.directory'))

    fs.readdirSync(domainsDirectory).forEach(domain => {
      let stats = fs.statSync(path.join(domainsDirectory, domain))

      if (stats.isDirectory()) {
        let pluginsPath = path.resolve(
          domainsDirectory,
          domain,
          config.get('paths.plugins', domain)
        )

        directories.push({
          domain,
          items: fs.readdirSync(pluginsPath),
          type: 'plugins'
        })

        let recipesPath = path.resolve(
          domainsDirectory,
          domain,
          config.get('paths.recipes', domain)
        )

        directories.push({
          domain,
          items: fs.readdirSync(recipesPath),
          type: 'recipes'
        })

        let routesPath = path.resolve(
          domainsDirectory,
          domain,
          config.get('paths.routes', domain)
        )

        directories.push({
          domain,
          items: fs.readdirSync(routesPath),
          type: 'routes'
        })
      }
    })
  }

  return directories.reduce((files, {domain, items, type}) => {
    items.forEach(file => {
      const extension = path.extname(file)
      const baseName = path.basename(file, extension)
      const fullPath = path.resolve(
        domain ? `${config.get('multiDomain.directory')}/${domain}` : '',
        config.get(`paths.${type}`),
        file
      )

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

      // Prepend workspace key with domain.
      if (domain) {
        workspaceKey = `${domain}:${workspaceKey}`
      }

      if (files[workspaceKey] !== undefined) {
        throw new Error(`Naming conflict: ${workspaceKey} exists in both '${files[workspaceKey].path}' and '${fullPath}'`)
      }

      files[workspaceKey] = {
        domain,
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
