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

describe.only('Routes', function () {
  this.timeout(8000)
  var tokenRoute = config.get('auth.tokenUrl')

  var sample = {}

  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config']
    config = require(__dirname + '/../../config')

    sample = {
      "route": 'sample-route',
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
      fs.unlinkSync(path.join(path.resolve(config.get('paths.routes')), sample.route + '.json'))
    }
    catch (err) {

    }
  })

  describe('Create', function () {
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
        .end(function(err ,res) {
          res.body.success.should.eql(false)
          res.body.errors.should.be.Array
          res.body.errors.should.containEql('Route name is missing')

          // Restore route name
          sample.route = routeName

          done()
        })
      })
    })

    it('should save route to filesystem', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        var stub = sinon.spy(fs, 'writeFileSync')

        client
        .post('/api/routes')
        .send(sample)
        .set('Authorization', 'Bearer ' + token)
        .end(function(err, res) {
          stub.called.should.eql(true)
          stub.calledWith(path.join(path.resolve(config.get('paths.routes')), sample.route + '.json')).should.eql(true)

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
    it('should evaluate route branches', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      var factory = require(__dirname + '/../../dadi/lib/handlers/factory')
      var Route = require(__dirname + '/../../dadi/lib/models/route')

      var processBranchesSpy = sinon.spy(Route.prototype, 'evaluateBranches')

      client
      .get('/' + sample.route + '/test.jpg')
      .end(function(err, res) {
        processBranchesSpy.calledTwice.should.eql(true)
        JSON.stringify(processBranchesSpy.firstCall.args[0]).should.eql(JSON.stringify(sample.branches))
        JSON.stringify(processBranchesSpy.secondCall.args[0]).should.eql(JSON.stringify(sample.branches))

        done()
      })
    })
  })
})
