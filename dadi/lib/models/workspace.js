const chokidar = require('chokidar')
const fs = require('fs-extra')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const domainManager = require('./domain-manager')

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
  this.TYPES = {
    plugins: '*.js',
    recipes: '*.json',
    routes: '*.json'
  }

  this.domains = []
  this.watchers = {}
  this.workspace = {}
}

/**
 * Builds a workspace tree and updates the internal reference.
 *
 * @return {Object} The new workspace
 */
Workspace.prototype.build = function () {
  return this.read().then(files => {
    this.workspace = files

    return files
  })
}

/**
 * Ensures that all workspace directories exist, creating any that
 * are missing.
 *
 * @return {Array<String>} list of directories created
 */
Workspace.prototype.createDirectories = function () {
  let directories = Object.keys(this.TYPES).map(type => {
    return path.resolve(config.get(`paths.${type}`))
  })

  domainManager.getDomains().forEach(({domain, path: domainPath}) => {
    Object.keys(this.TYPES).forEach(type => {
      directories.push(
        path.join(domainPath, config.get(`paths.${type}`, domain))
      )
    })
  })

  return Promise.all(
    directories.map(directory => {
      return fs.ensureDir(directory)
    })
  )
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
  let directories = []
  let queue = Object.keys(this.TYPES).reduce((queue, type) => {
    let directoryPath = path.resolve(
      config.get(`paths.${type}`)
    )

    return queue.then(() => {
      return fs.readdir(directoryPath).then(items => {
        directories.push({
          items,
          type
        })
      })
    })
  }, Promise.resolve())

  // Adding domain-specific workspace directories.
  if (config.get('multiDomain.enabled')) {
    queue = queue.then(() => {
      return Promise.all(
        domainManager.getDomains().map(({domain, path: domainPath}) => {
          return Promise.all(
            Object.keys(this.TYPES).map(type => {
              let typePath = path.resolve(
                domainPath,
                config.get(`paths.${type}`, domain)
              )

              return fs.readdir(typePath).then(items => {
                directories.push({
                  domain,
                  items,
                  type
                })
              })
            })
          )
        })
      )
    })
  }

  return this.createDirectories().then(() => {
    return queue
  }).then(() => {
    return directories.reduce((files, {domain, items, type}) => {
      items.forEach(file => {
        const extension = path.extname(file)
        const baseName = path.basename(file, extension)
        const fullPath = path.resolve(
          domain ? `${config.get('multiDomain.directory')}/${domain}` : '',
          config.get(`paths.${type}`),
          file
        )

        if (!['.js', '.json'].includes(extension)) return

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
  })
}

/**
 * Starts watching workspace files for changes and rebuild the workspace
 * tree when something changes.
 */
Workspace.prototype.startWatchingFiles = function () {
  let watchers = {}

  // Watch each workspace type.
  Object.keys(this.TYPES).forEach(type => {
    let directory = path.resolve(
      config.get(`paths.${type}`)
    )

    watchers[type] = chokidar.watch(
      `${directory}/${this.TYPES[type]}`,
      {usePolling: true}
    ).on('all', (event, filePath) => this.build())
  })

  // Watch files within domain-level workspace directories.
  domainManager.getDomains().forEach(({domain, path: domainPath}) => {
    Object.keys(this.TYPES).forEach(type => {
      let directory = path.resolve(
        domainPath,
        config.get(`paths.${type}`, domain)
      )

      watchers[`${domain}:${type}`] = chokidar.watch(
        `${directory}/${this.TYPES[type]}`,
        {usePolling: true}
      ).on('all', (event, filePath) => this.build())
    })
  })

  this.watchers = watchers
}

/**
 * Stop watching workspace files for changes.
 */
Workspace.prototype.stopWatchingFiles = function () {
  Object.keys(this.watchers).forEach(key => {
    this.watchers[key].close()
  })

  this.watchers = {}
}

module.exports = new Workspace()
module.exports.factory = () => new Workspace()
