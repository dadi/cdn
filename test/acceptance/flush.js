var fs = require('fs')
var should = require('should')
var request = require('supertest')
var assert = require('assert')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')
var cache = require(__dirname + '/../../dadi/lib/cache')
var config = require(__dirname + '/../../config')

let bearerToken
let configBackup

describe.only('Cache', function () {
  this.timeout(10000)

  describe('Flush', function () {
    describe('when multi-domain is not enabled', () => {
      // let configBackup = {
      //   images: config.get('images'),
      //   multiDomain: config.get('multiDomain')
      // }
      before(done => {
        configBackup = JSON.parse(fs.readFileSync(config.configPath()))

        // config.set('images.directory.enabled', false)
        // config.set('images.s3.enabled', false)
        // config.set('images.remote.enabled', true)
        // config.set('images.remote.path', 'http://one.somedomain.tech')
        // config.set('multiDomain.enabled', false)
        // config.set('caching.directory.enabled', true)
        // config.set('caching.redis.enabled', false)

        let newTestConfig = Object.assign({}, configBackup)
        newTestConfig.caching.directory.enabled = true
        newTestConfig.caching.redis.enabled = false
        newTestConfig.multiDomain = {
          enabled: false
        }

        cache.reset()

        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
        config.loadFile(config.configPath())

        done()
      })

      after(done => {
        // proxyServer.close(() => {
        fs.writeFileSync(config.configPath(), JSON.stringify(configBackup, null, 2))
        done()
        // })
      })

      beforeEach(done => {
        app.start(() => {
          help.getBearerToken((err, token) => {
            if (err) return done(err)

            bearerToken = token
            help.clearCache()
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

            client
            .get('/test.jpg?q=50')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')
              done()
            })
          })
        })
      })

      afterEach(function (done) {
        help.clearCache()
        app.stop(done)
      })

      it("should not flush cached items that don't match the specified path", function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        client
          .get('/test.jpg?q=70')
          .expect(200)
          .end(function (err, res) {
            res.headers['x-cache'].should.eql('MISS')

            client
              .post('/api/flush')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({pattern: '/test.jpg?q=70'})
              .expect(200)
              .end(function (err, res) {
                res.body.result.should.equal('success')

                setTimeout(function () {
                  client
                    .get('/test.jpg?q=50')
                    .expect(200)
                    .end(function (err, res) {
                      res.headers['x-cache'].should.eql('HIT')

                      setTimeout(function () {
                        client
                          .get('/test.jpg?q=70')
                          .expect(200)
                          .end(function (err, res) {
                            res.headers['x-cache'].should.eql('MISS')
                            done()
                          })
                      }, 500)
                    })
                }, 500)
              })
          })
      })

      it('should flush only cached items matching the specified path', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        client
          .get('/test.jpg?q=70')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)
            res.headers['x-cache'].should.exist
            res.headers['x-cache'].should.eql('MISS')

            client
              .post('/api/flush')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({pattern: '/test.jpg?q=70'})
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                res.body.result.should.equal('success')
                setTimeout(function () {
                  client
                    .get('/test.jpg?q=70')
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)
                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('MISS')
                      done()
                    })
                }, 500)
              })
          })
      })

      it('should flush all cached items when path is "*"', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
        client
          .get('/test.jpg?q=70')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)
            res.headers['x-cache'].should.exist
            res.headers['x-cache'].should.eql('MISS')

            client
              .post('/api/flush')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({pattern: '*'})
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                res.body.result.should.equal('success')

                setTimeout(function () {
                  client
                    .get('/test.jpg?q=50')
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)
                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('MISS')

                      setTimeout(function () {
                        client
                          .get('/test.jpg?q=70')
                          .expect(200)
                          .end(function (err, res) {
                            if (err) return done(err)
                            res.headers['x-cache'].should.exist
                            res.headers['x-cache'].should.eql('MISS')
                            done()
                          })
                      }, 500)
                    })
                }, 500)
              })
          })
      })

      it('should return error when no path is specified', function (done) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        client
          .post('/api/flush')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400, done)
      })
    })
  })
})
