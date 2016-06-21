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

describe('Controller', function () {
  this.timeout(4000)
  var tokenRoute = config.get('auth.tokenUrl')

  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())

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

  describe('Recipes', function () {
    var sample = {}

    beforeEach(function () {
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
              res.body.should.eql({ statusCode: 404, message: 'Unknown recipe "thumbxx.json"' })
              done()
            })
          })
        })
      })
    })
  })

  describe('Options Discovery', function (done) {
    it('should extract options from url path if no querystring', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
        .expect(200)
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()
          var options = method.firstCall.args[0]
          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          done()
        })
    })

    it('v2: should extract options from querystring if one is present', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/test.jpg?quality=50&width=801&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.firstCall.args[0]

          options.quality.should.eql(50)
          options.width.should.eql(801)
          options.height.should.eql(478)
          options.format.should.eql('jpg')
          done()
        })
    })

    it('v2: should extract output format from querystring if present', function (done) {
      // spy on the sanitiseOptions method to access the provided arguments
      var method = sinon.spy(imageHandler.ImageHandler.prototype, 'sanitiseOptions')

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/test.jpg?format=png&quality=50&width=801&height=478&gravity=North&resizeStyle=aspectfit&devicePixelRatio=2')
        .end(function (err, res) {
          imageHandler.ImageHandler.prototype.sanitiseOptions.restore()

          method.called.should.eql(true)
          var options = method.firstCall.args[0]
          options.format.should.eql('png')
          done()
        })
    })
  })

  describe('Assets', function (done) {
    beforeEach(function (done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.assets.directory.enabled = true
      newTestConfig.assets.directory.path = './test/assets'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      done()
    })

    it('should handle uncompressed JS file if uri is valid', function (done) {
      this.timeout(2000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/js/0/test.js')
        .expect(200, function (err, res) {
          res.should.exist
          done()
        })
    })

    it('should handle uncompressed CSS file if uri is valid', function (done) {
      this.timeout(2000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/css/0/test.css')
        .expect(200, function (err, res) {
          res.should.exist
          done()
        })
    })

    it('should handle compressed JS file if uri is valid', function (done) {
      this.timeout(2000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/js/1/test.js')
        .expect(200, function (err, res) {
          res.should.exist
          done()
        })
    })

    it('should handle compressed CSS file if uri is valid', function (done) {
      this.timeout(2000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/css/1/test.css')
        .expect(200, function (err, res) {
          res.should.exist
          done()
        })
    })

    it('should handle TTF file if uri is valid', function (done) {
      this.timeout(2000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      client
        .get('/fonts/test.ttf')
        .expect(200, function (err, res) {
          res.should.exist
          done()
        })
    })
  })

  it('should handle test image if image uri is valid', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.images.directory.enabled = true
    newTestConfig.images.directory.path = './test/images'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    client
      .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(200, done)
  })

  it('should return error if image uri is invalid', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.images.directory.enabled = true
    newTestConfig.images.directory.path = './test/images'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    client
      .get('/jpg/50/0/0/801/478/0/0/0/aspectfit/North/0/0/test.jpg')
      .expect(404, done)
  })

  it('should get image from cache if cache is enabled and cached item exists', function (done) {
    this.timeout(4000)

    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.caching.directory.enabled = true
    newTestConfig.images.directory.enabled = true
    newTestConfig.images.directory.path = './test/images'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    cache.reset()

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    client
      .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(200, function (err, res) {
        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('MISS')

        setTimeout(function () {
          client
            .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
            .expect(200, function (err, res) {
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('HIT')
              done()
            })
        }, 1000)
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

  it('should return error if compress parameter is not 0 or 1', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.assets.directory.enabled = true
    newTestConfig.assets.directory.path = './test/assets'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    client
      .get('/js/2/test.js')
      .expect(400, done)
  })

  it('should return error if font file type is not TTF, OTF, WOFF, SVG or EOT', function (done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.assets.directory.enabled = true
    newTestConfig.assets.directory.path = './test/assets'
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    config.loadFile(config.configPath())

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    client
      .get('/fonts/test.bad')
      .expect(400, done)
  })
})
