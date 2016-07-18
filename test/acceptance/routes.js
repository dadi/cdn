var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var request = require('supertest')

var cache = require(__dirname + '/../../dadi/lib/cache')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')
var Route = require(__dirname + '/../../dadi/lib/models/route')
var imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')

var testConfigString
var sampleRoute = 'sample-route'

describe('Routes', function () {
  this.timeout(8000)
  var tokenRoute = config.get('auth.tokenUrl')

  var sample = {}

  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())

    sample = {
      "route": sampleRoute,
      "branches": [
        {
          "condition": {
            "device": "desktop",
            "language": "en",
            "country": ["GB", "US"],
            "network": "cable"
          },
          "recipe": "thumbnail"
        },
        {
          "condition": {
            "device": ["mobile", "tablet"],
            "language": ["en", "pt"],
            "country": "GB",
            "network": ["cable", "dsl"]
          },
          "recipe": "recipe2"
        },
        {
          "recipe": "default-recipe"
        }
      ]
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
      fs.unlinkSync(path.join(path.resolve(config.get('paths.routes')), sampleRoute + '.json'))
    }
    catch (err) {

    }
  })

  describe.only('Create', function () {
    it('should not allow route create request without a valid token', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        client
          .post('/api/routes/new')
          .set('Authorization', 'Bearer ' + token.toString() + '1')
          .expect('content-type', 'application/json')
          .expect(401, done)
      })
    })

    it('should return error if no data was sent', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        client
          .post('/api/routes')
          .send({})
          .set('Authorization', 'Bearer ' + token)
          .expect(400, done)
      })
    })

    it('should return error if route name is missing', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        delete sample['route']

        client
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function(err ,res) {
          res.body.success.should.eql(false)
          res.body.errors.should.be.Array
          res.body.errors.should.containEql('Route name is missing')

          done()
        })
      })
    })

    it('should save route to filesystem', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        sample.route = sampleRoute

        var stub = sinon.spy(fs, 'writeFileSync')

        client
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function(err, res) {
          stub.called.should.eql(true)
          stub.calledWith(path.join(path.resolve(config.get('paths.routes')), sampleRoute + '.json')).should.eql(true)

          res.statusCode.should.eql(200)
          res.body.success.should.eql(true)

          fs.writeFileSync.restore()

          done()
        })
      })
    })

    it('should return error when trying to create route with existing name', function (done) {
     help.getBearerToken((err, token) => {
       var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

       sample.route = sampleRoute

       sinon.stub(Route.prototype, 'save').returns(false)

       client
       .post('/api/routes')
       .send(sample)
       .set('Authorization', 'Bearer ' + token)
       .end(function(err, res) {
          Route.prototype.save.restore()

          res.body.success.should.eql(false)
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
