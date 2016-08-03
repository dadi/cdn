var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var request = require('supertest')

var cache = require(__dirname + '/../../dadi/lib/cache')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')
var imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')

var testConfigString

describe('Recipes', function () {
  this.timeout(8000)
  var tokenRoute = config.get('auth.tokenUrl')

  var sample = {}

  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())

    sample = {
      "recipe": "sample-recipe",
      "path": "/test",
      "settings": {
        "format": "jpg",
        "quality": "80",
        "trim": "0",
        "trimFuzz": "0",
        "width": "1024",
        "height": "768",
        "cropX": "0",
        "cropY": "0",
        "ratio": "0",
        "devicePixelRatio": "0",
        "resizeStyle": "0",
        "gravity": "0",
        "filter": "0",
        "blur": "0",
        "strip": "0",
        "rotate": "0",
        "flip": "0"
      }
    }

    app.start(function (err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done()
      }, 500)
    })
  })

  afterEach(function (done) {
    help.clearCache()
    app.stop(done)
  })


  after(function () {
    try {
      fs.unlinkSync(path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json'))
    }
    catch (err) {

    }
  })

  describe('Create', function () {
    it('should not allow recipe create request without a valid token', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        client
          .post('/api/recipes/new')
          .set('Authorization', 'Bearer ' + token.toString() + '1')
          .expect('content-type', 'application/json')
          .expect(401, done)
      })
    })

    it('should return error if no data was sent', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        client
          .post('/api/recipes/new')
          .send({})
          .set('Authorization', 'Bearer ' + token)
          .expect(400, done)
      })
    })

    it('should return error if recipe name is missing', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        delete sample['recipe']

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function(err ,res) {
          res.body.error.should.be.Array
          res.body.error[0].error.should.eql('Property "recipe" not found in recipe')
          done()
        })
      })
    })

    it('should return error if recipe path is missing', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        delete sample['path']

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function(err ,res) {
          res.body.error.should.be.Array
          res.body.error[0].error.should.eql('Property "path" not found in recipe')
          done()
        })
      })
    })

    it('should return error if recipe settings are missing', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        delete sample['settings']

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function(err ,res) {
          res.body.error.should.be.Array
          res.body.error[0].error.should.eql('Property "settings" not found in recipe')
          done()
        })
      })
    })

    it('should set the correct recipe filepath', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        sample.recipe = 'thumbnail'

        var stub = sinon.stub(fs, 'writeFileSync', function (filePath, content) {
          filePath.should.eql(path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json'))
        })

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function(err ,res) {
          stub.called.should.eql(true)
          fs.writeFileSync.restore()

          done()
        })
      })
    })

    it('should save valid recipe to filesystem', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        sample.recipe = 'thumbnail'

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function(err ,res) {
          res.statusCode.should.eql(201)
          done()
        })
      })
    })
  })

  describe('Apply', function () {
    it('should apply the new recipe', function (done) {

      // set some config values
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = false
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var factory = require(__dirname + '/../../dadi/lib/handlers/factory')
      var spy = sinon.spy(factory.HandlerFactory.prototype, 'createFromRecipe')

      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        sample.recipe = 'thumbnail'

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function(err ,res) {
          res.statusCode.should.eql(201)

          client
          .get('/thumbnail/test.jpg')
          .end(function(err ,res) {
            factory.HandlerFactory.prototype.createFromRecipe.restore()
            spy.called.should.eql(true)
            spy.firstCall.args[0].should.eql('thumbnail')

            res.statusCode.should.eql(200)
            res.headers['content-type'].should.eql('image/jpeg')

            done()
          })
        })
      })
    })

    it('should return error if the recipe is not found', function (done) {

      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        sample.recipe = 'thumbnail'

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function(err ,res) {
          res.statusCode.should.eql(201)

          client
          .get('/thumbxx/test.jpg')
          .end(function(err ,res) {
            res.statusCode.should.eql(404)
            res.body.statusCode.should.eql(404)
            done()
          })
        })
      })
    })

    it('should handle image if recipe is valid ', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/sample-image-recipe/test.jpg')
        .expect(200)
        .end(function (err, res) {
          done()
        })
    })

    it('should return error if recipe is invalid ', function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/wrong_test_recipe/test.jpg')
        .expect(404, done)
    })
  })

  describe('File change monitor', function () {
    it('should reload the recipe when the file changes', function (done) {

      // set some config values
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = false
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      var factory = require(__dirname + '/../../dadi/lib/handlers/factory')
      var spy = sinon.spy(factory.HandlerFactory.prototype, 'createFromFormat')

      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        sample.recipe = 'thumbnail'

        client
        .post('/api/recipes/new')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function(err ,res) {
          res.statusCode.should.eql(201)

          client
          .get('/thumbnail/test.jpg')
          .end(function(err ,res) {

            factory.HandlerFactory.prototype.createFromFormat.restore()
            spy.firstCall.args[0].should.eql('thumbnail')
            spy.secondCall.args[0].should.eql('jpg')

            // Change the format within the recipe
            var recipeContent = fs.readFileSync(path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json'))
            var recipe = JSON.parse(recipeContent.toString())
            recipe.settings.format = 'png'

            fs.writeFileSync(path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json'), JSON.stringify(recipe))

            spy = sinon.spy(factory.HandlerFactory.prototype, 'createFromFormat')

            setTimeout(function() {
              client
              .get('/thumbnail/test.jpg')
              .end(function(err ,res) {

                factory.HandlerFactory.prototype.createFromFormat.restore()
                spy.firstCall.args[0].should.eql('thumbnail')
                spy.secondCall.args[0].should.eql('png')

                done()
              })
            }, 2500)
          })
        })
      })
    })
  })
})
