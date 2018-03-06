const config = require(__dirname + '/../../config')
const fs = require('fs')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const workspaceFactory = require(__dirname + '/../../dadi/lib/models/workspace').factory

/**
 * Generates a workspace file with the given type and content.
 * If `content` is falsy, the file is deleted.
 *
 * @param  {String} type
 * @param  {String} name
 * @param  {String} content
 * @return {String}         The full path to the generate file
 */
const mockWorkspaceFile = (type, name, content = null) => {
  const fullPath = path.join(
    path.resolve(config.get(`paths.${type}`)),
    name
  )

  if (content) {
    const serialisedContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2)

    fs.writeFileSync(fullPath, serialisedContent)

    return fullPath
  } else {
    try {
      fs.unlinkSync(fullPath)

      return fullPath
    } catch (err) {}
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
    it('should return a tree structure with the workspace files', done => {
      const samplePluginPath = mockWorkspaceFile('plugins', 'my-plugin.js', 'const a = "foo"')
      const sampleRecipe = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      const sampleRecipePath = mockWorkspaceFile('recipes', 'my-recipe.json', sampleRecipe)

      const tree = workspace.read()

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

      mockWorkspaceFile('plugins', 'my-plugin.js', null)
      mockWorkspaceFile('recipes', 'my-recipe.json', null)

      done()
    })

    it('should use the recipe path as workspace key and fall back to filename', done => {
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
      const sampleRecipe1Path = mockWorkspaceFile('recipes', 'my-first-recipe.json', sampleRecipe1)
      const sampleRecipe2Path = mockWorkspaceFile('recipes', 'my-second-recipe.json', sampleRecipe2)

      const tree = workspace.read()

      tree['my-recipe'].should.be.Object
      tree['my-second-recipe'].should.be.Object

      mockWorkspaceFile('recipes', 'my-first-recipe.json', null)
      mockWorkspaceFile('recipes', 'my-second-recipe.json', null)

      done()
    })

    it('should throw an error if there is a conflict in the naming of workspace files', done => {
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
      const sampleRecipe1Path = mockWorkspaceFile('recipes', 'my-recipe.json', sampleRecipe1)
      const sampleRecipe2Path = mockWorkspaceFile('recipes', 'my-other-recipe.json', sampleRecipe2)

      try {
        workspace.read()

        done(true)
      } catch (err) {
        err.message.should.eql(`Naming conflict: ${sampleRecipe1.recipe} exists in both '${sampleRecipe2Path}' and '${sampleRecipe1Path}'`)
      } finally {
        mockWorkspaceFile('recipes', 'my-recipe.json', null)
        mockWorkspaceFile('recipes', 'my-other-recipe.json', null)

        done()
      }
    })

    it('should read a fresh, uncached version of workspace files', done => {
      const sampleRecipe = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      let sampleRecipePath = mockWorkspaceFile('recipes', 'my-recipe.json', sampleRecipe)

      const tree = workspace.read()

      tree['my-recipe'].should.be.Object
      tree['my-recipe'].source.settings.format.should.eql('png')

      sampleRecipePath = mockWorkspaceFile('recipes', 'my-recipe.json', Object.assign({}, sampleRecipe, {
        settings: Object.assign({}, sampleRecipe.settings, {
          format: 'jpg'
        })
      }))

      const newTree = workspace.read()

      newTree['my-recipe'].should.be.Object
      newTree['my-recipe'].source.settings.format.should.eql('jpg')

      mockWorkspaceFile('recipes', 'my-recipe.json', null)

      done()
    })
  })

  describe('build()', () => {
    it('should generate a tree structure of the workspace files and save it internally', done => {
      const tree = workspace.read()

      workspace.workspace.should.eql({})
      workspace.build()
      workspace.workspace.should.eql(tree)

      done()
    })  
  })

  describe('get()', () => {
    it('should return the entire workspace tree when given no arguments', done => {
      const tree = workspace.read()

      workspace.build()
      workspace.get().should.eql(tree)

      done()
    })

    it('should return a single file with the key matching the argument', done => {
      const sampleRecipe = {
        recipe: 'my-recipe',
        path: '/directory',
        settings: {
          format: 'png'
        }
      }
      const sampleRecipePath = mockWorkspaceFile('recipes', 'my-recipe.json', sampleRecipe)
      const tree = workspace.read()

      workspace.build()

      const workspaceItem = workspace.get('my-recipe')

      workspaceItem.should.be.Object
      workspaceItem.source.should.eql(sampleRecipe)
      workspaceItem.type.should.eql('recipes')

      should.not.exist(workspace.get('not-existing-file'))

      mockWorkspaceFile('recipes', 'my-recipe.json', null)

      done()
    })
  })
})
