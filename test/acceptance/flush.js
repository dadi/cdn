const app = require('./../../dadi/lib/')
const assert = require('assert')
const cache = require('./../../dadi/lib/cache')
const config = require('./../../config')
const fs = require('fs')
const help = require('./help')
const nock = require('nock')
const request = require('supertest')
const should = require('should')

let bearerToken
let cdnUrl = `http://${config.get('server.host')}:${config.get('server.port')}`
let configBackup = config.get()

describe('Cache', function () {
  this.timeout(10000)

  describe('Flush', function () {
    describe('when multi-domain is not enabled', () => {
      beforeEach(done => {
        config.set('caching.directory.enabled', true)
        config.set('caching.redis.enabled', false)
        config.set('multiDomain.enabled', false)

        cache.reset()

        app.start(() => {
          help.getBearerToken((err, token) => {
            if (err) return done(err)

            bearerToken = token
            help.clearCache()

            request(`http://${config.get('server.host')}:${config.get('server.port')}`)
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

      afterEach(done => {
        help.clearCache()

        app.stop(done)

        config.set('caching.directory.enabled', configBackup.caching.directory.enabled)
        config.set('caching.redis.enabled', configBackup.caching.redis.enabled)
        config.set('multiDomain.enabled', configBackup.multiDomain.enabled)        
      })

      it('should not flush cached items that don\'t match the specified path', done => {
        request(cdnUrl)
          .get('/test.jpg?q=70')
          .expect(200)
          .end((err, res) => {
            res.headers['x-cache'].should.eql('MISS')

            request(cdnUrl)
              .post('/api/flush')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({pattern: '/test.jpg?q=70'})
              .expect(200)
              .end((err, res) => {
                res.body.result.should.equal('success')

                setTimeout(() => {
                  request(cdnUrl)
                    .get('/test.jpg?q=50')
                    .expect(200)
                    .end((err, res) => {
                      res.headers['x-cache'].should.eql('HIT')

                      setTimeout(() => {
                        request(cdnUrl)
                          .get('/test.jpg?q=70')
                          .expect(200)
                          .end((err, res) => {
                            res.headers['x-cache'].should.eql('MISS')
                            done()
                          })
                      }, 500)
                    })
                }, 500)
              })
          })
      })

      it('should flush only cached items matching the specified path', done => {
        request(cdnUrl)
          .get('/test.jpg?q=70')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            res.headers['x-cache'].should.exist
            res.headers['x-cache'].should.eql('MISS')

            request(cdnUrl)
              .post('/api/flush')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({pattern: '/test.jpg?q=70'})
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.body.result.should.equal('success')
                setTimeout(() => {
                  request(cdnUrl)
                    .get('/test.jpg?q=70')
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)
                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('MISS')
                      done()
                    })
                }, 500)
              })
          })
      })

      it('should flush all cached items when path is "*"', done => {
        request(cdnUrl)
          .get('/test.jpg?q=70')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            res.headers['x-cache'].should.exist
            res.headers['x-cache'].should.eql('MISS')

            request(cdnUrl)
              .post('/api/flush')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({pattern: '*'})
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.body.result.should.equal('success')

                setTimeout(() => {
                  request(cdnUrl)
                    .get('/test.jpg?q=50')
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)
                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('MISS')

                      setTimeout(() => {
                        request(cdnUrl)
                          .get('/test.jpg?q=70')
                          .expect(200)
                          .end((err, res) => {
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

      it('should return error when no path is specified', done => {
        request(cdnUrl)
          .post('/api/flush')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400, done)
      })
    })

    describe('when multi-domain is enabled', () => {
      beforeEach(done => {
        config.set('caching.directory.enabled', true)
        config.set('caching.redis.enabled', false)
        config.set('multiDomain.enabled', true)

        cache.reset()

        app.start(() => {
          help.getBearerToken((err, token) => {
            if (err) return done(err)

            bearerToken = token
            help.clearCache()

            done()
          })
        })
      })

      afterEach(done => {
        help.clearCache()

        app.stop(done)

        config.set('caching.directory.enabled', configBackup.caching.directory.enabled)
        config.set('caching.redis.enabled', configBackup.caching.redis.enabled)
        config.set('multiDomain.enabled', configBackup.multiDomain.enabled)        
      })

      it('should only flush cached items for the target domain', done => {
        request(cdnUrl)
          .get('/test.jpg')
          .set('host', 'testdomain.com:80')
          .expect(200)
          .end((err, res) => {
            res.headers['x-cache'].should.eql('MISS')

            request(cdnUrl)
              .get('/test.jpg')
              .set('host', 'localhost:80')
              .expect(200)
              .end((err, res) => {
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  request(cdnUrl)
                    .get('/test.jpg')
                    .set('host', 'testdomain.com:80')
                    .expect(200)
                    .end((err, res) => {
                      res.headers['x-cache'].should.eql('HIT')

                      request(cdnUrl)
                        .post('/api/flush')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .set('host', 'testdomain.com:80')
                        .send({pattern: '*'})
                        .expect(200)
                        .end((err, res) => {
                          res.body.result.should.equal('success')

                          setTimeout(() => {
                            request(cdnUrl)
                              .get('/test.jpg')
                              .set('host', 'testdomain.com:80')
                              .expect(200)
                              .end((err, res) => {
                                res.headers['x-cache'].should.eql('MISS')

                                request(cdnUrl)
                                  .get('/test.jpg')
                                  .set('host', 'localhost:80')
                                  .expect(200)
                                  .end((err, res) => {
                                    res.headers['x-cache'].should.eql('HIT')

                                    done()
                                  })

                              })
                          }, 500)
                        })
                    })
                }, 500)
              })
          })
      })

      it('should flush all cached items for a given domain', done => {
        request(cdnUrl)
          .get('/test.jpg')
          .set('host', 'testdomain.com:80')
          .expect(200)
          .end((err, res) => {
            res.headers['x-cache'].should.eql('MISS')

            request(cdnUrl)
              .get('/original.jpg')
              .set('host', 'testdomain.com:80')
              .expect(200)
              .end((err, res) => {
                res.headers['x-cache'].should.eql('MISS')

                setTimeout(() => {
                  request(cdnUrl)
                    .get('/test.jpg')
                    .set('host', 'testdomain.com:80')
                    .expect(200)
                    .end((err, res) => {
                      res.headers['x-cache'].should.eql('HIT')

                      request(cdnUrl)
                        .post('/api/flush')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .set('host', 'testdomain.com:80')
                        .send({pattern: '*'})
                        .expect(200)
                        .end((err, res) => {
                          res.body.result.should.equal('success')

                          setTimeout(() => {
                            request(cdnUrl)
                              .get('/test.jpg')
                              .set('host', 'testdomain.com:80')
                              .expect(200)
                              .end((err, res) => {
                                res.headers['x-cache'].should.eql('MISS')

                                request(cdnUrl)
                                  .get('/original.jpg')
                                  .set('host', 'testdomain.com:80')
                                  .expect(200)
                                  .end((err, res) => {
                                    res.headers['x-cache'].should.eql('MISS')

                                    done()
                                  })

                              })
                          }, 500)
                        })
                    })
                }, 500)
              })
          })
      })

      it('should not flush cached items that don\'t match the specified path', done => {
        request(cdnUrl)
          .get('/test.jpg?q=70')
          .set('host', 'localhost:80')
          .expect(200)
          .end((err, res) => {
            res.headers['x-cache'].should.eql('MISS')

            request(cdnUrl)
              .get('/test.jpg?q=50')
              .set('host', 'localhost:80')
              .expect(200)
              .end((err, res) => {
                request(cdnUrl)
                  .post('/api/flush')
                  .set('host', 'localhost:80')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send({pattern: '/test.jpg?q=70'})
                  .expect(200)
                  .end((err, res) => {
                    res.body.result.should.equal('success')

                    setTimeout(() => {
                      request(cdnUrl)
                        .get('/test.jpg?q=50')
                        .set('host', 'localhost:80')
                        .expect(200)
                        .end((err, res) => {
                          res.headers['x-cache'].should.eql('HIT')

                          setTimeout(() => {
                            request(cdnUrl)
                              .get('/test.jpg?q=70')
                              .set('host', 'localhost:80')
                              .expect(200)
                              .end((err, res) => {
                                res.headers['x-cache'].should.eql('MISS')
                                done()
                              })
                          }, 500)
                        })
                    }, 500)
                  })
              })
          })
      })

      it('should return error when no path is specified', done => {
        request(cdnUrl)
          .post('/api/flush')
          .set('host', 'localhost:80')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400, done)
      })
    })
  })
})
