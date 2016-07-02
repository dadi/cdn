var _ = require('lodash')
var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var request = require('supertest')
var _ = require('underscore')

var cache = require(__dirname + '/../../dadi/lib/cache')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')

var defaultConfig = {
  "status": {
    "enabled": true,
    "requireAuthentication": true,
    "standalone": false,
    "port": 8112,
    "routes": [
      {
        "route": "/test.jpg?format=png&quality=50&width=800&height=600",
        "expectedResponseTime": 0.025
      }
    ]
  }
}

function updateConfigAndReloadApp (configOverride) {
  delete require.cache[__dirname + '/../../config']
  config = require(__dirname + '/../../config')

  var testConfigString = fs.readFileSync(config.configPath())
  var newTestConfig = _.extend({}, JSON.parse(testConfigString), defaultConfig, configOverride)

  fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
  config.loadFile(config.configPath())

  // reload the app so it picks up config changes
  delete require.cache[require.resolve(__dirname + '/../../dadi/lib')]
  app = require(__dirname + '/../../dadi/lib')
}

describe('Status', function () {
  var statusRoute = '/api/status' // TODO move to config
  var bearerToken

  this.timeout(10000)

  before(function (done) {
    // make sure config is reset properly so these tests run fine
    updateConfigAndReloadApp({})
    done()
  })

  after(function (done) {
    // make sure config is reset properly so other tests run ok
    // it's essential that status.standalone is disabled
    updateConfigAndReloadApp({})
    done()
  })

  describe('Integrated', function () {

    describe('Authenticated', function () {

      beforeEach(function (done) {
        app.start(function (err) {
          if (err) return done(err)

          // give http.Server a moment to finish starting up
          // then grab a bearer token from it
          setTimeout(function () {
            help.getBearerToken(function (err, token) {
              if (err) return done(err)
              bearerToken = token
              done()
            })
          }, 500)
        })
      })

      afterEach(function (done) {
        help.clearCache()
        app.stop(done)
      })

      it('should return error if no token is given', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        client
          .post(statusRoute)
          .expect('content-type', 'application/json')
          .expect(401, done)
      })

      it('should return ok if token is given', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        client
          .post(statusRoute)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect('content-type', 'application/json')
          .expect(200, done)
      })

    })

    describe('Unauthenticated', function () {

      beforeEach(function (done) {
        updateConfigAndReloadApp({ "status": { "requireAuthentication": false } })

        app.start(function (err) {
          if (err) return done(err)

          // give http.Server a moment to finish starting up
          setTimeout(function () {
            done()
          }, 500)
        })
      })

      afterEach(function (done) {
        help.clearCache()
        app.stop(done)
      })

      it('should return ok even if no token is given', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        client
          .post(statusRoute)
          .expect('content-type', 'application/json')
          .expect(200, done)
      })

    })

  })

  describe('Standalone', function () {

    describe('Authenticated', function () {

      beforeEach(function (done) {
        updateConfigAndReloadApp({ "status": { "standalone": true, "requireAuthentication": true } })

        app.start(function (err) {
          if (err) return done(err)

          // give http.Server a moment to finish starting up
          // then grab a bearer token from it
          setTimeout(function () {
            help.getBearerToken(function (err, token) {
              if (err) return done(err)
              bearerToken = token
              done()
            })
          }, 500)
        })
      })

      afterEach(function (done) {
        help.clearCache()
        app.stop(done)
      })

      it('should return error if no token is given', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('status.port'))
        client
          .post(statusRoute)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            res.statusCode.should.eql(401)
            done()
          })
      })

      it('should return ok if token is given', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('status.port'))
        client
          .post(statusRoute)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect('content-type', 'application/json')
          .expect(200, done)
      })

    })

    describe('Unauthenticated', function () {

      beforeEach(function (done) {
        updateConfigAndReloadApp({ "status": { "standalone": true, "requireAuthentication": false } })

        app.start(function (err) {
          if (err) return done(err)

          // give http.Server a moment to finish starting up
          setTimeout(function () {
            done()
          }, 500)
        })
      })

      afterEach(function (done) {
        help.clearCache()
        app.stop(done)
      })

      it('should return ok even if no token is given', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('status.port'))
        client
          .post(statusRoute)
          .expect('content-type', 'application/json')
          .expect(200, done)
      })

    })

  })

})
