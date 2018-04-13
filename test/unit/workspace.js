const config = require(__dirname + '/../../config')
const fs = require('fs-extra')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const workspaceFactory = require(
  __dirname + '/../../dadi/lib/models/workspace'
).factory

/**
 * Generates a workspace file with the given type and content.
 * If `content` is falsy, the file is deleted.
 *
 * @param  {String} type
 * @param  {String} name
 * @param  {String} content
 * @return {String}         The full path to the generated file
 */
const mockWorkspaceFile = function ({
  content = {},
  delete: isDelete = false,
  domain,
  name,
  type
}) {
  let domainSubPath = domain
    ? path.join(config.get('multiDomain.directory'), domain)
    : ''
  let directory = path.resolve(
    domainSubPath,
    config.get(`paths.${type}`)
  )
  let fullPath = path.join(
    directory,
    name
  )

  if (isDelete) {
    try {
      fs.unlinkSync(fullPath)

      return fullPath
    } catch (err) {}
  } else {
    const serialisedContent = typeof content === 'string'
      ? content
      : JSON.stringify(content, null, 2)

    fs.ensureDirSync(directory)
    fs.writeFileSync(fullPath, serialisedContent)

    return fullPath
  }
}

let workspace

describe('Workspace', function () {
  beforeEach(() => {
    workspace = workspaceFactory()
  })

  it('should export an instance', done => {
    workspace.build.should.be.Function
    workspace.get.should.be.Function
    workspace.read.should.be.Function

    done()
  })

  it('should be initialised with an empty tree', done => {
    workspace.workspace.should.eql({})

    done()
  })

  describe('read()', () => {
    it('should return a tree structure with the workspace files', () => {
      const samplePluginPath = mockWorkspaceFile({
        type: 'plugins',
        name: 'my-plugin.js',
        content: 'const a = "foo"'
      })
      const sampleRecipe = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      const sampleRecipePath = mockWorkspaceFile({
        type: 'recipes',
        name: 'my-recipe.json',
        content: sampleRecipe
      })

      return workspace.read().then(tree => {
        // Plugin
        tree['my-plugin'].should.be.Object
        tree['my-plugin'].path.should.eql(samplePluginPath)
        tree['my-plugin'].type.should.eql('plugins')
        
        // Recipe
        const source = require(sampleRecipePath)

        tree['my-recipe'].should.be.Object
        JSON.stringify(tree['my-recipe'].source).should.eql(JSON.stringify(sampleRecipe))
        tree['my-recipe'].path.should.eql(sampleRecipePath)
        tree['my-recipe'].type.should.eql('recipes')

        mockWorkspaceFile({
          type: 'plugins',
          name: 'my-plugin.js',
          delete: true
        })
        mockWorkspaceFile({
          type: 'recipes',
          name: 'my-recipe.json',
          delete: true
        })        
      })
    })

    it('should read files from domain-specific workspace directories', () => {
      let configBackup = config.get('multiDomain')

      config.set('multiDomain.enabled', true)
      config.set('multiDomain.directory', 'domains')

      const samplePluginPath = mockWorkspaceFile({
        type: 'plugins',
        name: 'my-plugin.js',
        content: 'const a = "foo"'
      })
      const sampleRecipe = {
        recipe: 'my-domain-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      const sampleRecipePath = mockWorkspaceFile({
        domain: 'testdomain.com',
        type: 'recipes',
        name: 'my-domain-recipe.json',
        content: sampleRecipe
      })

      return workspace.read().then(tree => {
        // Plugin
        tree['my-plugin'].should.be.Object
        tree['my-plugin'].path.should.eql(samplePluginPath)
        tree['my-plugin'].type.should.eql('plugins')

        // Recipe
        const source = require(sampleRecipePath)

        tree['testdomain.com:my-domain-recipe'].should.be.Object
        JSON.stringify(tree['testdomain.com:my-domain-recipe'].source).should.eql(
          JSON.stringify(sampleRecipe)
        )
        tree['testdomain.com:my-domain-recipe'].path.should.eql(sampleRecipePath)
        tree['testdomain.com:my-domain-recipe'].type.should.eql('recipes')
        tree['testdomain.com:my-domain-recipe'].domain.should.eql('testdomain.com')

        mockWorkspaceFile({
          type: 'plugins',
          name: 'my-plugin.js',
          delete: true
        })
        mockWorkspaceFile({
          domain: 'testdomain.com',
          type: 'recipes',
          name: 'my-domain-recipe.json',
          delete: true
        })

        config.set('multiDomain', configBackup)        
      })
    })

    it('should use the recipe path as workspace key and fall back to filename', () => {
      const sampleRecipe1 = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      const sampleRecipe2 = {
        path: '/other-directory',
        settings: {
          format: 'jpg'
        }
      }
      const sampleRecipe1Path = mockWorkspaceFile({
        type: 'recipes',
        name: 'my-first-recipe.json',
        content: sampleRecipe1
      })
      const sampleRecipe2Path = mockWorkspaceFile({
        type: 'recipes',
        name: 'my-second-recipe.json',
        content: sampleRecipe2
      })

      return workspace.read().then(tree => {
        tree['my-recipe'].should.be.Object
        tree['my-second-recipe'].should.be.Object

        mockWorkspaceFile({
          type: 'recipes',
          name: 'my-first-recipe.json',
          delete: true
        })
        mockWorkspaceFile({
          type: 'recipes',
          name: 'my-second-recipe.json',
          delete: true
        })
      })
    })

    it('should throw an error if there is a conflict in the naming of workspace files', () => {
      const sampleRecipe1 = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      const sampleRecipe2 = {
        recipe: 'my-recipe',
        path: '/other-directory',
        settings: {
          format: 'jpg'
        }
      }
      const sampleRecipe1Path = mockWorkspaceFile({
        type: 'recipes',
        name: 'my-recipe.json',
        content: sampleRecipe1
      })
      const sampleRecipe2Path = mockWorkspaceFile({
        type: 'recipes',
        name: 'my-other-recipe.json',
        content: sampleRecipe2
      })

      return workspace.read().catch(err => {
        err.message.should.eql(
          `Naming conflict: ${sampleRecipe1.recipe} exists in both '${sampleRecipe2Path}' and '${sampleRecipe1Path}'`
        )

        mockWorkspaceFile({
          type: 'recipes',
          name: 'my-recipe.json',
          delete: true
        })
        mockWorkspaceFile({
          type: 'recipes',
          name: 'my-other-recipe.json',
          delete: true
        })
      })
    })

    it('should read a fresh, uncached version of workspace files', () => {
      const sampleRecipe = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      let sampleRecipePath = mockWorkspaceFile({
        type: 'recipes',
        name: 'my-recipe.json',
        content: sampleRecipe
      })

      return workspace.read().then(tree => {
        tree['my-recipe'].should.be.Object
        tree['my-recipe'].source.settings.format.should.eql('png')

        sampleRecipePath = mockWorkspaceFile({
          type: 'recipes',
          name: 'my-recipe.json',
          content: Object.assign(
            {},
            sampleRecipe,
            {
              settings: Object.assign(
                {},
                sampleRecipe.settings,
                {format: 'jpg'}
              )
            }
          )
        })

        return workspace.read()   
      }).then(newTree => {
        newTree['my-recipe'].should.be.Object
        newTree['my-recipe'].source.settings.format.should.eql('jpg')

        mockWorkspaceFile({
          type: 'recipes',
          name: 'my-recipe.json',
          delete: true
        })
      })
    })
  })

  describe('build()', () => {
    it('should generate a tree structure of the workspace files and save it internally', () => {
      return workspace.read().then(tree1 => {
        workspace.workspace.should.eql({})
        

        return workspace.build().then(tree2 => {
          workspace.workspace.should.eql(tree1)
          workspace.workspace.should.eql(tree2)
        })
      })
    })  
  })

  describe('get()', () => {
    it('should return the entire workspace tree when given no arguments', () => {
      return workspace.read().then(tree => {
        return workspace.build().then(() => {
          workspace.get().should.eql(tree)    
        })
      })
    })

    it('should return a single file with the key matching the argument', () => {
      const sampleRecipe = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      const sampleRecipePath = mockWorkspaceFile({
        type: 'recipes',
        name: 'my-recipe.json',
        content: sampleRecipe
      })

      return workspace.build().then(() => {
        const workspaceItem = workspace.get('my-recipe')

        workspaceItem.should.be.Object
        workspaceItem.source.should.eql(sampleRecipe)
        workspaceItem.type.should.eql('recipes')

        should.not.exist(workspace.get('not-existing-file'))

        mockWorkspaceFile({
          type: 'recipes',
          name: 'my-recipe.json',
          delete: true
        })        
      })
    })

    describe('by domain', () => {
      let configBackup = config.get('multiDomain')

      beforeEach(() => {
        config.set('multiDomain.enabled', true)
        config.set('multiDomain.directory', 'domains')
      })

      afterEach(() => {
        config.set('multiDomain', configBackup)
      })

      it('should return a file for the given domain', () => {
        const sampleRecipe = {
          recipe: 'my-recipe',
          path: '/directory',
          settings: {
            format: 'png'
          }
        }
        const sampleRecipePath = mockWorkspaceFile({
          domain: 'testdomain.com',
          type: 'recipes',
          name: 'my-recipe.json',
          content: sampleRecipe
        })

        return workspace.build().then(() => {
          should.not.exist(workspace.get('my-recipe'))

          let workspaceItem = workspace.get('my-recipe', 'testdomain.com')

          workspaceItem.should.be.Object
          workspaceItem.source.should.eql(sampleRecipe)
          workspaceItem.type.should.eql('recipes')

          mockWorkspaceFile({
            domain: 'testdomain.com',
            type: 'recipes',
            name: 'my-recipe.json',
            delete: true
          })
        })
      })

      it('should return `undefined` if the given file exists at root level, not in the domain', () => {
        const sampleRecipe = {
          recipe: 'my-recipe',
          path: '/directory',
          settings: {
            format: 'png'
          }
        }
        const sampleRecipePath = mockWorkspaceFile({
          type: 'recipes',
          name: 'my-recipe.json',
          content: sampleRecipe
        })

        return workspace.build().then(() => {
          should.not.exist(workspace.get('my-recipe', 'testdomain.com'))

          mockWorkspaceFile({
            type: 'recipes',
            name: 'my-recipe.json',
            delete: true
          })  
        })
      })

      it('should return the file for the domain if the a file with the same key exists at root level', () => {
        const sampleRecipe1 = {
          recipe: 'my-recipe',
          path: '/directory',
          settings: {
            format: 'png'
          }
        }
        const sampleRecipe1Path = mockWorkspaceFile({
          type: 'recipes',
          name: 'my-recipe.json',
          content: sampleRecipe1
        })
        const sampleRecipe2 = {
          recipe: 'my-recipe',
          path: '/directory',
          settings: {
            format: 'jpg'
          }
        }
        const sampleRecipe2Path = mockWorkspaceFile({
          domain: 'testdomain.com',
          type: 'recipes',
          name: 'my-recipe.json',
          content: sampleRecipe2
        })

        return workspace.build().then(() => {
          workspace.get('my-recipe').source.settings.format.should.eql('png')
          workspace.get('my-recipe', 'testdomain.com').source.settings.format.should.eql('jpg')

          mockWorkspaceFile({
            type: 'recipes',
            name: 'my-recipe.json',
            delete: true
          })

          mockWorkspaceFile({
            domain: 'testdomain.com',
            type: 'recipes',
            name: 'my-recipe.json',
            delete: true
          })
        })
      })

      it('should return `undefined` if the given file exists at domain level but `multiDomain.enabled` is `false`', () => {
        config.set('multiDomain.enabled', false)

        const sampleRecipe = {
          recipe: 'my-recipe',
          path: '/directory',
          settings: {
            format: 'png'
          }
        }
        const sampleRecipePath = mockWorkspaceFile({
          domain: 'testdomain.com',
          type: 'recipes',
          name: 'my-recipe.json',
          content: sampleRecipe
        })

        return workspace.build().then(() => {
          should.not.exist(workspace.get('my-recipe'))
          should.not.exist(workspace.get('my-recipe', 'testdomain.com'))

          mockWorkspaceFile({
            domain: 'testdomain.com',
            type: 'recipes',
            name: 'my-recipe.json',
            delete: true
          })
        })
      })
    })
  })
})
