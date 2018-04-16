var should = require('should')
var request = require('supertest')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')
var fs = require('fs')

describe('Authentication', function () {
  var tokenRoute = config.get('auth.tokenUrl')

  before(function (done) {
    app.start(function (err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done()
      }, 500)
    })
  })

  after(function (done) {
    app.stop(done)
  })

  it('should issue a bearer token', function (done) {
    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

    client
      .post(tokenRoute)
      .send({
        clientId: 'test',
        secret: 'test'
      })
      .expect('content-type', 'application/json')
      .expect('pragma', 'no-cache')
      .expect('Cache-Control', 'no-store')
      .expect(200, done)
  })

  it('should not issue token if credentials are invalid', function (done) {
    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

    client
      .post(tokenRoute)
      .send({
        clientId: 'test123',
        secret: 'badSecret',
        code: ' '
      })
      .expect(401, done)
  })

  it('should allow `/api/flush` request containing token', function (done) {
    help.getBearerToken(function (err, token) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      client
        .post('/api/flush')
        .send({pattern: 'test'})
        .set('Authorization', 'Bearer ' + token)
        .expect('content-type', 'application/json')
        .expect(200, done)
    })
  })

  it('should not allow `/api/flush` request containing invalid token', function (done) {
    help.getBearerToken(function (err, token) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      client
        .post('/api/flush')
        .send({pattern: 'test'})
        .set('Authorization', 'Bearer badtokenvalue')
        .expect(401, done)
    })
  })

  it('should not allow `/api/flush` request with expired tokens', function (done) {
    this.timeout(4000)

    var oldTtl = Number(config.get('auth.tokenTtl'))
    config.set('auth.tokenTtl', 1)

    var _done = function (err) {
      config.set('auth.tokenTtl', oldTtl)
      done(err)
    }

    help.getBearerToken(function (err, token) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      client
        .post('/api/flush')
        .send({pattern: 'test'})
        .set('Authorization', 'Bearer ' + token)
        .expect(200, function (err) {
          if (err) return _done(err)

          setTimeout(function () {
            client
              .post('/api')
              .send({invalidate: 'test'})
              .set('Authorization', 'Bearer ' + token)
              .expect(401, _done)
          }, 2000)
        })
    })
  })
})
