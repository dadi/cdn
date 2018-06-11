var should = require('should')
var request = require('supertest')
var app = require(__dirname + '/../../dadi/lib/')
var config = require(__dirname + '/../../config')

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var secureClientHost = 'https://' + config.get('server.host') + ':' + config.get('server.port')

var client = request(clientHost)
var secureClient = request(secureClientHost)

describe('http2', () => {
  before((done) => {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    done()
  })

  beforeEach((done) => {
    delete require.cache[require.resolve(__dirname + '/../../dadi/lib/')]
    app = require(__dirname + '/../../dadi/lib/')

    done()
  })

  afterEach((done) => {
    config.set('server.protocol', 'http')
    config.set('server.redirectPort', '')
    config.set('server.sslPassphrase', '')
    config.set('server.sslPrivateKeyPath', '')
    config.set('server.sslCertificatePath', '')

    // try and close the server, unless it's crashed (as with SSL errors)
    try {
      app.stop(done)
    } catch (ex) {
      done()
    }
  })

  it('should respond to a http1 request even if http2 is enabled', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

    app.start(function (err) {
      if (err) return done(err)

      secureClient
        .get('/')
        .end((err, res) => {
          if (err) throw err

          // We're assuming here that the 'supertest' module doesn't support http2
          // If they ever add it this test might need to be changed!

          res.statusCode.should.eql(200)
          
          done()
        })
    })
  })
})

describe('SSL', () => {
  before((done) => {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    done()
  })

  beforeEach((done) => {
    delete require.cache[require.resolve(__dirname + '/../../dadi/lib/')]
    app = require(__dirname + '/../../dadi/lib/')

    done()
  })

  afterEach((done) => {
    config.set('server.protocol', 'http')
    config.set('server.redirectPort', '')
    config.set('server.sslPassphrase', '')
    config.set('server.sslPrivateKeyPath', '')
    config.set('server.sslCertificatePath', '')

    // try and close the server, unless it's crashed (as with SSL errors)
    try {
      app.stop(done)
    } catch (ex) {
      done()
    }
  })

  it('should respond to a http request when ssl is disabled', (done) => {
    app.start(function (err) {
      if (err) return done(err)

      client
        .get('/')
        .end((err, res) => {
          if (err) throw err
          res.statusCode.should.eql(200)
          done()
        })
    })
  })

  it('should redirect http request to https when redirectPort is set', function (done) {
    config.set('server.protocol', 'https')
    config.set('server.redirectPort', '9999')
    config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

    app.start(function (err) {
      if (err) return done(err)

      var httpClient = request('http://' + config.get('server.host') + ':9999')
      httpClient
        .get('/')
        .expect(301)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
    })
  })

  it('should respond to a https request when using protected ssl key with a passphrase', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
    config.set('server.sslPassphrase', 'changeme')

    app.start(function (err) {
      if (err) return done(err)

      secureClient
        .get('/')
        .end((err, res) => {
          if (err) throw err
          res.statusCode.should.eql(200)
          done()
        })
    })
  })

  it('should throw a bad password read exception when using protected ssl key with the wrong passphrase', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
    config.set('server.sslPassphrase', 'incorrectamundo')

    try {
      app.start(() => {})
    } catch (ex) {
      ex.message.should.eql('error starting https server: incorrect ssl passphrase')
    }

    done()
  })

  it('should throw a bad password read exception when using protected ssl key without a passphrase', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
    config.set('server.sslPassphrase', '')

    try {
      app.start(() => {})
    } catch (ex) {
      ex.message.should.eql('error starting https server: required ssl passphrase not provided')
    }

    done()
  })
})
