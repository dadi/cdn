const jwt = require('jsonwebtoken')
const should = require('should')
const request = require('supertest')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')
const fs = require('fs')

let cdnUrl = `http://${config.get('server.host')}:${config.get('server.port')}`
let configBackup = config.get()

describe('Authentication', function () {
  let tokenRoute = config.get('auth.tokenUrl')

  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 500)
    })
  })

  beforeEach(done => {
    config.set('auth.clientId', 'test')
    config.set('auth.secret', 'test')
    config.set('auth.privateKey', 'test')
    done()
  })

  after(done => {
    app.stop(done)
  })

  it('should issue a bearer token', done => {
    request(cdnUrl)
      .post(tokenRoute)
      .send({
        clientId: 'test',
        secret: 'test'
      })
      .expect('content-type', 'application/json')
      .expect('pragma', 'no-cache')
      .expect('Cache-Control', 'no-store')
      .expect(200)
      .end((err, res) => {
        res.body.accessToken.should.be.String
        res.body.tokenType.should.be.String
        res.body.expiresIn.should.be.Number

        done()
      })
  })

  it('should not issue token if credentials are invalid', done => {
    request(cdnUrl)
      .post(tokenRoute)
      .send({
        clientId: 'test123',
        secret: 'badSecret',
        code: ' '
      })
      .expect(401, done)
  })

  it('should not issue token if credentials are the null defaults', done => {
    config.set('auth.clientId', null)
    config.set('auth.secret', null)

    request(cdnUrl)
      .post(tokenRoute)
      .send({
        clientId: 'test123',
        secret: 'badSecret',
        code: ' '
      })
      .end((err, res) => {
        res.statusCode.should.eql(401)
        res.headers['www-authenticate'].should.eql('Bearer realm="/token"')
        done()
      })
  })

  it('should not issue token if privateKey for token signing is not set', done => {
    config.set('auth.privateKey', null)

    request(cdnUrl)
      .post(tokenRoute)
      .send({
        clientId: 'test123',
        secret: 'badSecret',
        code: ' '
      })
      .end((err, res) => {
        res.statusCode.should.eql(401)
        res.headers['www-authenticate'].should.eql('Bearer, error="no_private_key", error_description="No private key configured in auth.privateKey"')
        done()
      })
  })

  it('should allow `/api/flush` request containing token', done => {
    help.getBearerToken((err, token) => {
      request(cdnUrl)
        .post('/api/flush')
        .send({pattern: 'test'})
        .set('Authorization', 'Bearer ' + token)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(200)
          done()
        })
    })
  })

  it('should not allow `/api/flush` request containing invalid token', done => {
    help.getBearerToken((err, token) => {
      request(cdnUrl)
        .post('/api/flush')
        .send({pattern: 'test'})
        .set('Authorization', 'Bearer badtokenvalue')
        .expect(401, done)
    })
  })

  it('should not allow `/api/flush` request with expired tokens', done => {
    config.set('auth.tokenTtl', 1)

    let _done = err => {
      config.set('auth.tokenTtl', configBackup.auth.tokenTtl)

      done(err)
    }

    help.getBearerToken((err, token) => {
      request(cdnUrl)
        .post('/api/flush')
        .send({pattern: 'test'})
        .set('Authorization', 'Bearer ' + token)
        .expect(200, (err) => {
          if (err) return _done(err)

          setTimeout(() => {
            request(cdnUrl)
              .post('/api')
              .send({invalidate: 'test'})
              .set('Authorization', 'Bearer ' + token)
              .expect(401, _done)
          }, 2000)
        })
    })
  }).timeout(4000)

  describe('when multi-domain is enabled', () => {
    before(() => {
      config.set('multiDomain.enabled', true)
      config.set('multiDomain.directory', 'domains')

      config.loadDomainConfigs()

      config.set('auth.clientId', 'testxyz', 'testdomain.com')
      config.set('auth.secret', 'testabc', 'testdomain.com')
      config.set('auth.privateKey', 'test123', 'testdomain.com')
    })

    after(() => {
      config.set('multiDomain.enabled', configBackup.multiDomain.enabled)
      config.set('multiDomain.directory', configBackup.multiDomain.directory)
    })

    it('should encode the domain in the JWT', done => {
      request(cdnUrl)
        .post(tokenRoute)
        .send({
          clientId: 'testxyz',
          secret: 'testabc'
        })
        .set('host', 'testdomain.com:80')
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200)
        .end((err, res) => {
          res.body.accessToken.should.be.String
          res.body.tokenType.should.be.String
          res.body.expiresIn.should.be.Number

          jwt.verify(
            res.body.accessToken,
            config.get('auth.privateKey', 'testdomain.com'),
            (err, decoded) => {
              if (err) return done(err)

              decoded.domain.should.eql('testdomain.com')

              done()
            }
          )
        })
    })

    it('should reject bearer tokens that were not generated for the current domain', done => {
      request(cdnUrl)
        .post(tokenRoute)
        .send({
          clientId: 'testxyz',
          secret: 'testabc'
        })
        .set('host', 'testdomain.com:80')
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200)
        .end((err, res) => {
          let token = res.body.accessToken

          request(cdnUrl)
            .post('/api/flush')
            .set('host', 'testdomain.com:80')
            .send({pattern: 'test'})
            .set('Authorization', 'Bearer ' + token)
            .expect('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              request(cdnUrl)
                .post('/api/flush')
                .set('host', 'localhost:80')
                .send({pattern: 'test'})
                .set('Authorization', 'Bearer ' + token)
                .expect('content-type', 'application/json')
                .expect(401, done)
            })
        })
    })

    it('should validate the clientId/secret as per the domain configuration', done => {
      config.set('auth.clientId', 'testClient1', 'localhost')
      config.set('auth.secret', 'superSecret1', 'localhost')
      config.set('auth.privateKey', 'privateKey1', 'localhost')

      config.set('auth.clientId', 'testClient2', 'testdomain.com')
      config.set('auth.secret', 'superSecret2', 'testdomain.com')
      config.set('auth.privateKey', 'privateKey2', 'testdomain.com')

      request(cdnUrl)
        .post(tokenRoute)
        .send({
          clientId: 'test',
          secret: 'test'
        })
        .set('host', 'localhost:80')
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(401)
        .end((err, res) => {
          request(cdnUrl)
            .post(tokenRoute)
            .send({
              clientId: 'test',
              secret: 'test'
            })
            .set('host', 'testdomain.com:80')
            .expect('content-type', 'application/json')
            .expect('pragma', 'no-cache')
            .expect('Cache-Control', 'no-store')
            .expect(401)
            .end((err, res) => {
              request(cdnUrl)
                .post(tokenRoute)
                .send({
                  clientId: 'testClient1',
                  secret: 'superSecret1'
                })
                .set('host', 'localhost:80')
                .expect('content-type', 'application/json')
                .expect('pragma', 'no-cache')
                .expect('Cache-Control', 'no-store')
                .expect(200)
                .end((err, res) => {
                  res.body.accessToken.should.be.String

                  request(cdnUrl)
                    .post(tokenRoute)
                    .send({
                      clientId: 'testClient2',
                      secret: 'superSecret2'
                    })
                    .set('host', 'testdomain.com:80')
                    .expect('content-type', 'application/json')
                    .expect('pragma', 'no-cache')
                    .expect('Cache-Control', 'no-store')
                    .expect(200)
                    .end((err, res) => {
                      res.body.accessToken.should.be.String

                      done()
                    })
                })
            })
        })
    })

    it('should encode JWTs with the private key and TTL defined for each domain', done => {
      config.set('auth.clientId', 'testClient1', 'localhost')
      config.set('auth.secret', 'superSecret1', 'localhost')
      config.set('auth.privateKey', 'privateKey1', 'localhost')
      config.set('auth.tokenTtl', 10000, 'localhost')

      config.set('auth.clientId', 'testClient2', 'testdomain.com')
      config.set('auth.secret', 'superSecret2', 'testdomain.com')
      config.set('auth.privateKey', 'privateKey2', 'testdomain.com')
      config.set('auth.tokenTtl', 20000, 'testdomain.com')

      let startTime = Math.floor(Date.now() / 1000)

      request(cdnUrl)
        .post(tokenRoute)
        .send({
          clientId: 'testClient1',
          secret: 'superSecret1'
        })
        .set('host', 'localhost:80')
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200)
        .end((err, res) => {
          jwt.verify(
            res.body.accessToken,
            'privateKey1',
            (err, decoded) => {
              if (err) return done(err)

              (decoded.exp - startTime).should.eql(10000)
              decoded.domain.should.eql('localhost')

              request(cdnUrl)
                .post(tokenRoute)
                .send({
                  clientId: 'testClient2',
                  secret: 'superSecret2'
                })
                .set('host', 'testdomain.com:80')
                .expect('content-type', 'application/json')
                .expect('pragma', 'no-cache')
                .expect('Cache-Control', 'no-store')
                .expect(200)
                .end((err, res) => {
                  jwt.verify(
                    res.body.accessToken,
                    'privateKey2',
                    (err, decoded) => {
                      if (err) return done(err)

                      (decoded.exp - startTime).should.eql(20000)
                      decoded.domain.should.eql('testdomain.com')

                      done()
                    }
                  )
                })
            }
          )
        })
    })
  })
})
