const fs = require('fs-extra')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

const cache = require(__dirname + '/../../dadi/lib/cache')
const domainManager = require(__dirname + '/../../dadi/lib/models/domain-manager')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')
const imageHandler = require(__dirname + '/../../dadi/lib/handlers/image')

let config = require(__dirname + '/../../config')
let cdnUrl = `http://${config.get('server.host')}:${config.get('server.port')}`
let testConfigString

describe('Recipes', function () {
  this.timeout(8000)
  let tokenRoute = config.get('auth.tokenUrl')

  let sample = {}

  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    testConfigString = fs.readFileSync(config.configPath())

    sample = {
      'recipe': 'sample-recipe',
      'path': '/test',
      'settings': {
        'format': 'jpg',
        'quality': '80',
        'trim': '0',
        'trimFuzz': '0',
        'width': '1024',
        'height': '768',
        'cropX': '0',
        'cropY': '0',
        'ratio': '0',
        'devicePixelRatio': '0',
        'resizeStyle': '0',
        'gravity': '0',
        'filter': '0',
        'blur': '0',
        'strip': '0',
        'rotate': '0',
        'flip': '0'
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

    try {
      fs.unlinkSync(path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json'))
    } catch (err) {

    }    
  })

  describe('Create', function () {
    it('should not allow recipe create request without a valid token', function (done) {
      help.getBearerToken((err, token) => {
        request(cdnUrl)
          .post('/api/recipes')
          .set('Authorization', 'Bearer ' + token.toString() + '1')
          .expect('content-type', 'application/json')
          .expect(401, done)
      })
    })

    it('should return error if no data was sent', function (done) {
      help.getBearerToken((err, token) => {
        request(cdnUrl)
          .post('/api/recipes')
          .send({})
          .set('Authorization', 'Bearer ' + token)
          .expect(400, done)
      })
    })

    it('should return error if recipe name is missing', function (done) {
      help.getBearerToken((err, token) => {
        delete sample['recipe']

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function (err, res) {
          res.body.success.should.eql(false)
          res.body.errors.should.be.Array
          res.body.errors[0].error.should.eql('Property "recipe" not found in recipe')
          done()
        })
      })
    })

    it('should return error if recipe name is too short', function (done) {
      help.getBearerToken((err, token) => {
        sample['recipe'] = 'xxxx'

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function (err, res) {
          res.body.success.should.eql(false)
          res.body.errors.should.be.Array
          res.body.errors[0].error.should.eql('Recipe name must be 5 characters or longer and contain only uppercase and lowercase letters, dashes and underscores')
          done()
        })
      })
    })

    it('should return error if recipe settings are missing', function (done) {
      help.getBearerToken((err, token) => {
        delete sample['settings']

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function (err, res) {
          res.body.success.should.eql(false)
          res.body.errors.should.be.Array
          res.body.errors[0].error.should.eql('Property "settings" not found in recipe')
          done()
        })
      })
    })

    it('should set the correct recipe filepath', function (done) {
      help.getBearerToken((err, token) => {
        sample.recipe = 'thumbnail'

        let stub = sinon.stub(fs, 'writeJson').resolves(true)

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          stub.called.should.eql(true)
          stub.getCall(0).args[0].should.eql(
            path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json')
          )
          fs.writeJson.restore()

          done()
        })
      })
    })

    it('should save valid recipe to filesystem', function (done) {
      help.getBearerToken((err, token) => {
        sample.recipe = 'thumbnail'

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)
          done()
        })
      })
    })
  })

  describe('Apply', function () {
    it('should apply the new recipe', function (done) {
      // set some config values
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = false
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      help.getBearerToken((err, token) => {
        sample.recipe = 'thumbnail'

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/thumbnail/inside-test.jpg')
            .end(function (err, res) {
              res.statusCode.should.eql(200)
              res.headers['content-type'].should.eql('image/jpeg')

              done()
            })
          }, 500)
        })
      })
    })

    it('should return error if the recipe is not found', function (done) {
      help.getBearerToken((err, token) => {
        sample.recipe = 'thumbnail'

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/thumbxx/test.jpg')
            .end(function (err, res) {
              res.statusCode.should.eql(404)
              res.body.statusCode.should.eql(404)
              done()
            })
          }, 500)
        })
      })
    })

    it('should handle image if recipe is valid', () => {
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      return help.imagesEqual({
        base: 'test/images/test.jpg',
        test: '/sample-image-recipe/test.jpg'
      }).then(match => {
        match.should.eql(true)
      })
    })

    it('should handle JS file if recipe is valid', function (done) {
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.assets.directory.enabled = true
      newTestConfig.assets.directory.path = './test/assets'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      request(cdnUrl)
        .get('/sample-js-recipe/test-es6.js')
        .set('user-agent', 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; Trident/5.0)')
        .expect(200)
        .end(function (err, res) {
          res.text.should.eql('"use strict";var makeFoo=function(a){return"I foo, you "+a};')

          done()
        })
    })

    it('should return error if recipe is invalid ', function (done) {
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      request(cdnUrl)
        .get('/wrong_test_recipe/test.jpg')
        .expect(404, done)
    })
  })

  describe('File change monitor', function () {
    it('should reload the recipe when the file changes', function (done) {
      // set some config values
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = false
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      help.getBearerToken((err, token) => {
        sample.recipe = 'thumbnail'

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/thumbnail/inside-test.jpg')
            .end(function (err, res) {
              res.headers['content-type'].should.eql('image/jpeg')

              // Change the format within the recipe
              let recipeContent = fs.readFileSync(path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json'))
              let recipe = JSON.parse(recipeContent.toString())
              recipe.settings.format = 'png'

              fs.writeFileSync(path.join(path.resolve(config.get('paths.recipes')), 'thumbnail.json'), JSON.stringify(recipe))

              setTimeout(function () {
                request(cdnUrl)
                .get('/thumbnail/inside-test.jpg')
                .end(function (err, res) {
                  res.headers['content-type'].should.eql('image/png')

                  done()
                })
              }, 2500)
            })
          }, 500)
        })
      })
    })
  })
})

describe('Recipes (with multi-domain)', () => {
  let configBackup = config.get()
  let sample = {
    recipe: 'test-domain-recipe',
    settings: {
      format: 'png'
    }
  }

  beforeEach(done => {
    config.set('multiDomain.enabled', true)
    config.set('multiDomain.directory', 'domains')

    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 500)
    })
  })

  afterEach(done => {
    config.set('multiDomain.enabled', configBackup.multiDomain.enabled)
    config.set('multiDomain.directory', configBackup.multiDomain.directory)

    app.stop(err => {
      done()
    })
  })

  it('should create a recipe for the given domain only', done => {
    help.getBearerToken('localhost', (err, token) => {
      request(cdnUrl)
      .post('/api/recipes')
      .send(sample)
      .set('Authorization', 'Bearer ' + token)
      .set('host', 'localhost:80')
      .expect(201)
      .end((err, res) => {
        setTimeout(() => {
          request(cdnUrl)
          .get('/test-domain-recipe/test.jpg')
          .set('host', 'localhost:80')
          .expect(200)
          .end((err, res) => {
            res.headers['content-type'].should.eql('image/png')

            request(cdnUrl)
            .get('/test-domain-recipe/test.jpg')
            .set('host', 'testdomain.com:80')
            .expect(404)
            .end((err, res) => {
              let recipePath = path.resolve(
                path.join(
                  domainManager.getDomain('localhost').path,
                  config.get('paths.recipes', 'localhost'),
                  'test-domain-recipe.json'
                )
              )

              fs.remove(recipePath).then(done)
            })
          })
        }, 500)
      })
    })
  })
})
