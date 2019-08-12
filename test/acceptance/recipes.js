const fs = require('fs-extra')
const nock = require('nock')
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
let configBackup = config.get()
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
      'recipe': 'test-recipe',
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
        'flip': '0',
        'transform': '1'
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
      fs.unlinkSync(path.join(path.resolve(config.get('paths.recipes')), 'test-recipe.json'))
    } catch (err) {}

    try {
      fs.unlinkSync(path.join(path.resolve(config.get('paths.recipes')), 'test-recipe-two.json'))
    } catch (err) {}
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
          .expect(400, (err, res) => {
            res.body.errors[0].should.eql('Bad Request')

            done()
          })
      })
    })

    it('should return error if recipe body is not valid JSON', function (done) {
      help.getBearerToken((err, token) => {
        request(cdnUrl)
          .post('/api/recipes')
          .set('Content-Type', 'application/json')
          .send('{"recipe":"foobar"')
          .set('Authorization', 'Bearer ' + token)
          .expect(400, (err, res) => {
            res.body.errors[0].should.eql('Invalid JSON Syntax')

            done()
          })
      })
    })

    it('should return error if recipe name is missing', function (done) {
      help.getBearerToken((err, token) => {
        request(cdnUrl)
        .post('/api/recipes')
        .send(Object.assign({}, sample, {recipe: undefined}))
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
        request(cdnUrl)
        .post('/api/recipes')
        .send(Object.assign({}, sample, {recipe: 'xxxx'}))
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
        request(cdnUrl)
        .post('/api/recipes')
        .send(Object.assign({}, sample, {settings: undefined}))
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

    it('should return error if recipe already exists', function (done) {
      help.getBearerToken((err, token) => {
        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .post('/api/recipes')
            .send(sample)
            .set('Authorization', 'Bearer ' + token)
            .end(function (err, res) {
              res.statusCode.should.eql(400)
              res.body.errors[0].should.eql(`Route ${sample.recipe} already exists`)

              done()
            })            
          }, 300)
        })
      })
    })

    it('should return error if recipe save fails', function (done) {
      let mockWriteJson = sinon.stub(fs, 'writeJson').rejects(
        new Error()
      )

      help.getBearerToken((err, token) => {
        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(400)
          res.body.errors[0].should.eql('Error when saving recipe')

          mockWriteJson.restore()

          done()
        })
      })
    })    

    it('should set the correct recipe filepath', function (done) {
      help.getBearerToken((err, token) => {
        let stub = sinon.stub(fs, 'writeJson').resolves(true)

        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          stub.called.should.eql(true)
          stub.getCall(0).args[0].should.eql(
            path.join(path.resolve(config.get('paths.recipes')), 'test-recipe.json')
          )
          fs.writeJson.restore()

          done()
        })
      })
    })

    it('should save valid recipe to filesystem', function (done) {
      help.getBearerToken((err, token) => {
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
        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/test-recipe/inside-test.jpg')
            .end(function (err, res) {
              res.statusCode.should.eql(200)
              res.headers['content-type'].should.eql('image/jpeg')

              done()
            })
          }, 500)
        })
      })
    })

    it('should prepend the contents of the `path` property to the image path, if `path` is a relative path', done => {
      let server = nock('https://one.somedomain.tech')
        .get('/test/images/mock.png')
        .replyWithFile(200, 'test/images/visual/measure1.png', {
          'Content-Type': 'image/png'
        })

      // set some config values
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = false
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.remote.enabled = true
      newTestConfig.images.remote.path = 'https://one.somedomain.tech'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      help.getBearerToken((err, token) => {
        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/test-recipe/images/mock.png')
            .expect(200)
            .end((err, res) => {
              server.isDone().should.eql(true)

              done()
            })
          }, 500)
        })
      })
    })

    it('should use the value of the `path` property as the base URL if `path` is a full URL, replacing the one defined in the config', done => {
      let server = nock('https://two.somedomain.tech')
        .get('/test/images/mock.png')
        .reply(200, 'test/images/visual/measure1.png', {
          'Content-Type': 'image/png'
        })

      // set some config values
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = false
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = false
      newTestConfig.images.s3.enabled = false
      newTestConfig.images.remote.enabled = true
      newTestConfig.images.remote.path = 'https://one.somedomain.tech'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      help.getBearerToken((err, token) => {
        request(cdnUrl)
        .post('/api/recipes')
        .send(Object.assign({}, sample, {path: 'https://two.somedomain.tech/test'}))
        .set('Authorization', 'Bearer ' + token)
        .end((err, res) => {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/test-recipe/images/mock.png')
            .expect(200)
            .end((err, res) => {
              server.isDone().should.eql(true)

              done()
            })
          }, 500)
        })
      })
    })

    it('should return error if the recipe is not found', function (done) {
      let server = nock('https://one.somedomain.tech')
        .get('/thumbxx/test.jpg')
        .reply(404)

      config.set('notFound.images.enabled', false)

      help.getBearerToken((err, token) => {
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

              config.set('notFound.images.enabled', configBackup.notFound.images.enabled)

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

    it('should not return the same cached result for an image obtained with and without a recipe', function (done) {
      // set some config values
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = true
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      help.getBearerToken((err, token) => {
        request(cdnUrl)
        .post('/api/recipes')
        .send(Object.assign({}, sample, {path: undefined}))
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/test-recipe/original.jpg')
            .end(function (err, res) {
              res.statusCode.should.eql(200)
              res.headers['content-type'].should.eql('image/jpeg')
              res.headers['x-cache'].should.eql('MISS')

              request(cdnUrl)
              .get('/original.jpg')
              .end(function (err, res) {
                res.statusCode.should.eql(200)
                res.headers['content-type'].should.eql('image/jpeg')
                res.headers['x-cache'].should.eql('MISS')

                request(cdnUrl)
                .get('/test-recipe/original.jpg')
                .end(function (err, res) {
                  res.statusCode.should.eql(200)
                  res.headers['content-type'].should.eql('image/jpeg')
                  res.headers['x-cache'].should.eql('HIT')

                  request(cdnUrl)
                  .get('/original.jpg')
                  .end(function (err, res) {
                    res.statusCode.should.eql(200)
                    res.headers['content-type'].should.eql('image/jpeg')
                    res.headers['x-cache'].should.eql('HIT')

                    done()
                  })
                })
              })
            })
          }, 500)
        })
      })
    })

    it('should not return the same cached result for an image obtained via two recipes with different options', function (done) {
      // set some config values
      let newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = true
      newTestConfig.caching.redis.enabled = false
      cache.reset()
      newTestConfig.images.directory.enabled = true
      newTestConfig.images.directory.path = './test/images'
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      config.loadFile(config.configPath())

      help.getBearerToken((err, token) => {
        request(cdnUrl)
        .post('/api/recipes')
        .send(Object.assign({}, sample, {path: undefined}))
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          request(cdnUrl)
          .post('/api/recipes')
          .send(Object.assign({}, sample, {
            recipe: 'test-recipe-two',
            path: undefined,
            settings: Object.assign({}, sample.settings, {
              quality: 70
            })
          }))
          .set('Authorization', 'Bearer ' + token)
          .end(function (err, res) {
            res.statusCode.should.eql(201)          

            setTimeout(() => {
              request(cdnUrl)
              .get('/test-recipe/original.jpg')
              .end(function (err, res) {
                res.statusCode.should.eql(200)
                res.headers['content-type'].should.eql('image/jpeg')
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  request(cdnUrl)
                  .get('/test-recipe/original.jpg')
                  .end(function (err, res) {
                    res.statusCode.should.eql(200)
                    res.headers['content-type'].should.eql('image/jpeg')
                    res.headers['x-cache'].should.eql('HIT')

                    request(cdnUrl)
                    .get('/test-recipe-two/original.jpg')
                    .end(function (err, res) {
                      res.statusCode.should.eql(200)
                      res.headers['content-type'].should.eql('image/jpeg')
                      res.headers['x-cache'].should.eql('MISS')

                      setTimeout(() => {
                        request(cdnUrl)
                        .get('/test-recipe-two/original.jpg')
                        .end(function (err, res) {
                          res.statusCode.should.eql(200)
                          res.headers['content-type'].should.eql('image/jpeg')
                          res.headers['x-cache'].should.eql('HIT')

                          done()
                        })
                      }, 600)
                    })                    
                  })              
                }, 600)
              })
            }, 600)
          })
        })
      })
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
        request(cdnUrl)
        .post('/api/recipes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          res.statusCode.should.eql(201)

          setTimeout(() => {
            request(cdnUrl)
            .get('/test-recipe/inside-test.jpg')
            .end(function (err, res) {
              res.headers['content-type'].should.eql('image/jpeg')

              // Change the format within the recipe
              let recipeContent = fs.readFileSync(path.join(path.resolve(config.get('paths.recipes')), 'test-recipe.json'))
              let recipe = JSON.parse(recipeContent.toString())
              recipe.settings.format = 'png'

              fs.writeFileSync(path.join(path.resolve(config.get('paths.recipes')), 'test-recipe.json'), JSON.stringify(recipe))

              setTimeout(function () {
                request(cdnUrl)
                .get('/test-recipe/inside-test.jpg')
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
  let sample = {
    recipe: 'test-domain-recipe',
    settings: {
      format: 'png'
    }
  }

  beforeEach(done => {
    config.set('multiDomain.enabled', true)
    config.set('multiDomain.directory', 'domains')

    config.loadDomainConfigs()

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
