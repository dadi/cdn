const fs = require('fs-extra')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

const cache = require(__dirname + '/../../dadi/lib/cache')
const domainManager = require(__dirname + '/../../dadi/lib/models/domain-manager')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')
const Route = require(__dirname + '/../../dadi/lib/models/route')

let config = require(__dirname + '/../../config')
let cdnUrl = `http://${config.get('server.host')}:${config.get('server.port')}`

describe('Routes', function () {
  this.timeout(8000)
  let tokenRoute = config.get('auth.tokenUrl')

  beforeEach(done => {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 500)
    })
  })

  afterEach(done => {
    app.stop(done)
  })  

  describe('Create', function () {
    let sample = {}

    beforeEach(() => {
      sample = {
        'route': 'sample-route',
        'branches': [
          {
            'condition': {
              'device': 'desktop',
              'language': 'en',
              // "country": ["GB", "US"],
              'network': 'cable'
            },
            'recipe': 'thumbnail'
          },
          {
            'recipe': 'default-recipe'
          }
        ]
      }
    })

    afterEach(() => {
      try {
        fs.unlinkSync(
          path.join(
            path.resolve(config.get('paths.routes')),
            sample.route + '.json'
          )
        )
      } catch (err) {}
    })

    it('should not allow route create request without a valid token', done => {
      help.getBearerToken(function (err, token) {
        request(cdnUrl)
          .post('/api/routes/new')
          .set('Authorization', 'Bearer ' + token.toString() + '1')
          .expect('content-type', 'application/json')
          .expect(401, done)
      })
    })

    it('should return error if no data was sent', done => {
      help.getBearerToken(function (err, token) {
        
        request(cdnUrl)
          .post('/api/routes')
          .send({})
          .set('Authorization', 'Bearer ' + token)
          .expect(400, done)
      })
    })

    it('should return error if route name is missing', done => {
      help.getBearerToken(function (err, token) {
        var routeName = sample.route

        delete sample.route

        request(cdnUrl)
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function (err, res) {
          res.body.success.should.eql(false)
          res.body.errors.should.be.Array
          res.body.errors.should.containEql('Route name is missing')

          // Restore route name
          sample.route = routeName

          done()
        })
      })
    })

    it('should return error if route name is too short', done => {
      help.getBearerToken(function (err, token) {
        var routeName = sample.route

        sample.route = 'xxxx'

        request(cdnUrl)
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .expect(400)
        .end(function (err, res) {
          res.body.success.should.eql(false)
          res.body.errors.should.be.Array
          res.body.errors.should.containEql('Route name must be 5 characters or longer and contain only uppercase and lowercase letters, dashes and underscores')

          // Restore route name
          sample.route = routeName

          done()
        })
      })
    })

    it('should save route to filesystem', done => {
      help.getBearerToken((err, token) => {
        
        request(cdnUrl)
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(function () {
            var expectedPath = path.join(path.resolve(config.get('paths.routes')), sample.route + '.json')
            fs.stat(expectedPath, (err, stats) => {
              should.not.exist(err)
              res.statusCode.should.eql(200)
              res.body.success.should.eql(true)

              done()
            })
          }, 1000)
        })
      })
    })

    it('should return error when trying to create route with existing name', done => {
      help.getBearerToken((err, token) => {
        
        request(cdnUrl)
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(function () {
            request(cdnUrl)
            .post('/api/routes')
            .send(sample)
            .set('Authorization', 'Bearer ' + token)
            .end(function (err, res) {
              res.body.success.should.eql(false)
              done()
            })
          }, 1000)
        })
      })
    })
  })

  describe('Apply', function () {
    const jpgRecipe = {
      recipe: 'jpg-recipe',
      settings: {
        format: 'jpg'
      }
    }
    const pngRecipe = {
      recipe: 'png-recipe',
      settings: {
        format: 'png'
      }
    }
    const getRecipePath = name => {
      return path.join(
        path.resolve(config.get('paths.recipes')),
        name + '.json'
      )
    }

    let testRoute = {
      'route': 'test-route',
      'branches': []
    }

    const testRoutePath = path.join(
      path.resolve(config.get('paths.routes')),
      testRoute.route + '.json'
    )

    before(() => {
      fs.writeFileSync(getRecipePath('jpg-recipe'), JSON.stringify(jpgRecipe, null, 2))
      fs.writeFileSync(getRecipePath('png-recipe'), JSON.stringify(pngRecipe, null, 2))
    })

    after(() => {
      try {
        fs.unlinkSync(getRecipePath('jpg-recipe'))
        fs.unlinkSync(getRecipePath('png-recipe'))
      } catch (err) {}
    })

    afterEach(done => {
      try {
        fs.unlinkSync(testRoutePath)
      } catch (err) {}

      setTimeout(done, 500)
    })    

    it('should choose a route branch if the "device" condition matches', done => {
      let userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_1 like Mac OS X) AppleWebKit/602.2.14 (KHTML, like Gecko) Version/10.0 Mobile/14B72 Safari/602.1'

      testRoute.branches = [
        {
          'condition': {
            'device': 'mobile',
          },
          'recipe': 'png-recipe'
        },
        {
          'recipe': 'jpg-recipe'
        }
      ]

      help.getBearerToken(function (err, token) {
        request(cdnUrl)
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            request(cdnUrl)
            .get('/' + testRoute.route + '/test.jpg')
            .set('user-agent', userAgent)
            .end(function (err, res) {
              res.headers['content-type'].should.eql('image/png')

              done()
            })
          }, 500)
        })
      })
    })

    it('should skip a route branch if the "device" condition does not match the device type', done => {
      let userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8'

      testRoute.branches = [
        {
          'condition': {
            'device': 'mobile',
          },
          'recipe': 'png-recipe'
        },
        {
          'recipe': 'jpg-recipe'
        }
      ]

      help.getBearerToken(function (err, token) {
        request(cdnUrl)
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            request(cdnUrl)
            .get('/' + testRoute.route + '/test.jpg')
            .set('user-agent', userAgent)
            .end(function (err, res) {
              res.headers['content-type'].should.eql('image/jpeg')

              done()
            })
          }, 500)
        })
      })
    })

    it('should choose a route branch if the "language" condition matches', done => {
      let userLanguage = 'en-GB,en;q=0.8'

      testRoute.branches = [
        {
          'condition': {
            'language': ['en', 'pt'],
            'languageMinQuality': 0.5
          },
          'recipe': 'png-recipe'
        },
        {
          'recipe': 'jpg-recipe'
        }
      ]

      help.getBearerToken(function (err, token) {
        request(cdnUrl)
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            request(cdnUrl)
            .get('/' + testRoute.route + '/test.jpg')
            .set('accept-language', userLanguage)
            .end(function (err, res) {
              res.headers['content-type'].should.eql('image/png')

              done()
            })
          }, 500)
        })
      })
    })

    it('should skip a route branch if the "language" condition does not match the client\'s language', done => {
      let userLanguage = 'en-GB,en;q=0.8'

      testRoute.branches = [
        {
          'condition': {
            'language': ['pt'],
            'languageMinQuality': 0.5
          },
          'recipe': 'png-recipe'
        },
        {
          'recipe': 'jpg-recipe'
        }
      ]

      help.getBearerToken(function (err, token) {
        request(cdnUrl)
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            request(cdnUrl)
            .get('/' + testRoute.route + '/test.jpg')
            .set('accept-language', userLanguage)
            .end(function (err, res) {
              res.headers['content-type'].should.eql('image/jpeg')

              done()
            })
          }, 500)
        })
      })
    })

    it('should skip a route branch if the "language" condition matches the client\'s language but with a non-sufficient quality parameter', done => {
      let userLanguage = 'pt,en;q=0.3'

      testRoute.branches = [
        {
          'condition': {
            'language': ['en'],
            'languageMinQuality': 0.5
          },
          'recipe': 'png-recipe'
        },
        {
          'recipe': 'jpg-recipe'
        }
      ]

      help.getBearerToken(function (err, token) {
        request(cdnUrl)
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            request(cdnUrl)
            .get('/' + testRoute.route + '/test.jpg')
            .set('accept-language', userLanguage)
            .end(function (err, res) {
              res.headers['content-type'].should.eql('image/jpeg')

              done()
            })
          }, 500)
        })
      })
    })
  })
})

describe('Routes (with multi-domain)', () => {
  let configBackup = config.get()
  let sample = {
    route: 'test-domain-route',
    branches: [
      {
        condition: {
          device: 'desktop'
        },
        recipe: 'test-recipe'
      },
      {
        recipe: 'test-recipe'
      }
    ]
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

  it('should create a route for the given domain only', done => {
    help.getBearerToken((err, token) => {
      request(cdnUrl)
      .post('/api/routes')
      .send(sample)
      .set('Authorization', 'Bearer ' + token)
      .set('host', 'localhost:80')
      .expect(201)
      .end((err, res) => {
        setTimeout(() => {
          request(cdnUrl)
          .get('/test-domain-route/test.jpg')
          .set('host', 'localhost:80')
          .expect(200)
          .end((err, res) => {
            res.headers['content-type'].should.eql('image/png')

            request(cdnUrl)
            .get('/test-domain-recipe/test.jpg')
            .set('host', 'testdomain.com:80')
            .expect(404)
            .end((err, res) => {
              let routePath = path.resolve(
                path.join(
                  domainManager.getDomain('localhost').path,
                  config.get('paths.routes', 'localhost'),
                  'test-domain-route.json'
                )
              )

              fs.remove(routePath).then(done)
            })
          })
        }, 500)
      })
    })
  })
})
