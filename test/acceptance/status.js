const nock = require('nock')
const should = require('should')
const request = require('supertest')

const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')

describe('Status', function() {
  const statusRoute = '/api/status' // TODO move to config
  let bearerToken
  const statusConfigBackup = config.get('status')
  const urlConfigBackup = config.get('publicUrl')

  this.timeout(10000)

  before(function(done) {
    done()
  })

  after(function(done) {
    // make sure config is reset properly so other tests run ok
    // it's essential that status.standalone is disabled
    config.set('status.standalone', false)
    config.set(
      'status.requireAuthentication',
      statusConfigBackup.requireAuthentication
    )

    config.set('publicUrl.host', urlConfigBackup.host)
    config.set('publicUrl.port', urlConfigBackup.port)

    done()
  })

  describe('Base URL', function() {
    beforeEach(function(done) {
      config.set('publicUrl.host', 'www.example.com')
      config.set('publicUrl.port', 80)

      const statusScope = nock('http://www.example.com')
        .get('/test.jpg?format=png&quality=50&width=800&height=600')
        .reply(200)

      app.start(function(err) {
        if (err) return done(err)

        // give http.Server a moment to finish starting up
        // then grab a bearer token from it
        setTimeout(function() {
          help.getBearerToken(function(err, token) {
            if (err) return done(err)
            bearerToken = token
            done()
          })
        }, 500)
      })
    })

    afterEach(function(done) {
      help.clearCache()
      app.stop(done)
    })

    it('should use publicUrl as base for status checks, if configured', function(done) {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .post(statusRoute)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect('content-type', 'application/json')
        .expect(200)
        .end((err, res) => {
          console.log('nock :', nock)
          const statusResponse = res.body

          statusResponse.status.status.should.eql(200)
          done()
        })
    })
  })

  describe('Integrated', function() {
    describe('Authenticated', function() {
      beforeEach(function(done) {
        app.start(function(err) {
          if (err) return done(err)

          config.set('status.standalone', false)
          config.set('status.requireAuthentication', true)

          // give http.Server a moment to finish starting up
          // then grab a bearer token from it
          setTimeout(function() {
            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token
              done()
            })
          }, 500)
        })
      })

      afterEach(function(done) {
        config.set('status.standalone', statusConfigBackup.standalone)
        config.set(
          'status.requireAuthentication',
          statusConfigBackup.requireAuthentication
        )

        help.clearCache()
        app.stop(done)
      })

      it('should return error if no token is given', function(done) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post(statusRoute)
          .expect('content-type', 'application/json')
          .expect(401, done)
      })

      it('should return ok if token is given', function(done) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post(statusRoute)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect('content-type', 'application/json')
          .expect(200, done)
      })
    })

    describe('Unauthenticated', function() {
      beforeEach(function(done) {
        app.start(function(err) {
          if (err) return done(err)

          config.set('status.standalone', false)
          config.set('status.requireAuthentication', false)

          // give http.Server a moment to finish starting up
          setTimeout(function() {
            done()
          }, 500)
        })
      })

      afterEach(function(done) {
        config.set('status.standalone', statusConfigBackup.standalone)
        config.set(
          'status.requireAuthentication',
          statusConfigBackup.requireAuthentication
        )

        help.clearCache()
        app.stop(done)
      })

      it('should return ok even if no token is given', function(done) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post(statusRoute)
          .expect(200)
          .end((err, res) => {
            done()
          })
      })
    })
  })

  describe('Standalone', function() {
    describe('Authenticated', function() {
      beforeEach(function(done) {
        config.set('status.standalone', true)
        config.set('status.requireAuthentication', true)

        app.start(function(err) {
          if (err) return done(err)

          // give http.Server a moment to finish starting up
          // then grab a bearer token from it
          setTimeout(function() {
            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token
              done()
            })
          }, 500)
        })
      })

      afterEach(function(done) {
        config.set('status.standalone', statusConfigBackup.standalone)
        config.set(
          'status.requireAuthentication',
          statusConfigBackup.requireAuthentication
        )

        help.clearCache()
        app.stop(done)
      })

      it('should return error if no token is given', function(done) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('status.port')
        )

        client
          .post(statusRoute)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            res.statusCode.should.eql(401)
            done()
          })
      })

      it('should return ok if token is given', function(done) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('status.port')
        )

        client
          .post(statusRoute)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect('content-type', 'application/json')
          .expect(200, done)
      })
    })

    describe('Unauthenticated', function() {
      beforeEach(function(done) {
        config.set('status.standalone', true)
        config.set('status.requireAuthentication', false)

        app.start(function(err) {
          if (err) return done(err)

          // give http.Server a moment to finish starting up
          setTimeout(function() {
            done()
          }, 500)
        })
      })

      afterEach(function(done) {
        config.set('status.standalone', statusConfigBackup.standalone)
        config.set(
          'status.requireAuthentication',
          statusConfigBackup.requireAuthentication
        )

        help.clearCache()
        app.stop(done)
      })

      it('should return ok even if no token is given', function(done) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('status.port')
        )

        client
          .post(statusRoute)
          .expect(200)
          .end((err, res) => {
            done()
          })
      })
    })
  })
})
