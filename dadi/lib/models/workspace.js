const fs = require('fs-extra')
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
  return this.read().then(workspace => {
    this.workspace = workspace

    return this.workspace
  })
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
  let domainDirectoryQueue

  // Adding domain-specific workspace directories.
  if (config.get('multiDomain.enabled')) {
    let domainsDirectory = path.resolve(config.get('multiDomain.directory'))

    domainDirectoryQueue = fs.readdir(domainsDirectory).then(domains => {
      let domainQueue = domains.map(domain => {
        return fs.stat(path.join(domainsDirectory, domain))
          .then(stats => {
            if (!stats.isDirectory()) return

            ['plugins', 'recipes', 'routes'].forEach(type => {
              directories.push(
                path.resolve(
                  domainsDirectory,
                  domain,
                  config.get(`paths.${type}`, domain)
                )
              )
            })
          })
      })

      return Promise.all(domainQueue)
    })
  }

  return Promise.resolve(domainDirectoryQueue).then(() => {
    return Promise.all(
      directories.map(directory => {
        return fs.ensureDir(directory)
      })
    )
  })
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
  let queue = ['plugins', 'recipes', 'routes'].reduce((queue, type) => {
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
    let domainsDirectory = path.resolve(
      config.get('multiDomain.directory')
    )

    queue = queue.then(() => {
      return fs.readdir(domainsDirectory)
    }).then(domains => {
      let domainQueue = domains.map(domain => {
        let domainPath = path.join(
          domainsDirectory,
          domain
        )

        return fs.stat(domainPath).then(stats => {
          if (!stats.isDirectory()) return

          let typeQueue = ['plugins', 'recipes', 'routes'].map(type => {
            let typePath = path.resolve(
              domainsDirectory,
              domain,
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

          return Promise.all(typeQueue)
        })
      })

      return Promise.all(domainQueue)
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
  })
}

module.exports = new Workspace()
module.exports.factory = () => new Workspace()
