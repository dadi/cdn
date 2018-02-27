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

describe('Routes', function () {
  this.timeout(8000)
  var tokenRoute = config.get('auth.tokenUrl')

  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    app.start(function (err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done()
      }, 500)
    })
  })

  afterEach(function (done) {
    app.stop(done)
  })  

  describe('Create', function () {
    var sample = {}

    beforeEach(function () {
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

    afterEach(function () {
      try {
        fs.unlinkSync(path.join(path.resolve(config.get('paths.routes')), sample.route + '.json'))
      } catch (err) {}
    })

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
        var routeName = sample.route

        delete sample.route

        client
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

    it('should return error if route name is too short', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        var routeName = sample.route

        sample.route = 'xxxx'

        client
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

    it('should save route to filesystem', function (done) {
      return help.getBearerToken((err, token) => {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        return client
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(function () {
            var expectedPath = path.join(path.resolve(config.get('paths.routes')), sample.route + '.json')
            fs.stat(expectedPath, (err, stats) => {
              (err === null).should.eql(true)

              res.statusCode.should.eql(200)
              res.body.success.should.eql(true)

              done()
            })
          }, 1000)
        })
      })
    })

    it('should return error when trying to create route with existing name', function (done) {
      help.getBearerToken((err, token) => {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        sinon.stub(Route.prototype, 'save').returns(false)

        client
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          Route.prototype.save.restore()

          res.body.success.should.eql(false)
          done()
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

    afterEach(function (done) {
      try {
        fs.unlinkSync(testRoutePath)
      } catch (err) {}

      setTimeout(done, 500)
    })    

    it('should choose a route branch if the "device" condition matches', function (done) {
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_1 like Mac OS X) AppleWebKit/602.2.14 (KHTML, like Gecko) Version/10.0 Mobile/14B72 Safari/602.1'

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
        client
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            client
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

    it('should skip a route branch if the "device" condition does not match the device type', function (done) {
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8'

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
        client
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            client
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

    it('should choose a route branch if the "language" condition matches', function (done) {
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      const userLanguage = 'en-GB,en;q=0.8'

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
        client
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            client
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

    it('should skip a route branch if the "language" condition does not match the client\'s language', function (done) {
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      const userLanguage = 'en-GB,en;q=0.8'

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
        client
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            client
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

    it('should skip a route branch if the "language" condition matches the client\'s language but with a non-sufficient quality parameter', function (done) {
      const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      const userLanguage = 'pt,en;q=0.3'

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
        client
        .post('/api/routes')
        .send(testRoute)
        .set('Authorization', 'Bearer ' + token)
        .end(function (err, res) {
          setTimeout(() => {
            client
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
