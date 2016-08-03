var should = require('should')
var request = require('supertest')
var app = require(__dirname + '/../../dadi/lib/')
var config = require(__dirname + '/../../config')

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var secureClientHost = 'https://' + config.get('server.host') + ':' + config.get('server.port')

var client = request(clientHost)
var secureClient = request(secureClientHost)

describe('SSL', () => {

  before((done) => {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    done()
  })

  beforeEach((done) => {
    // give the server a chance to close & release the port
    setTimeout(done, 500)
  })

  afterEach((done) => {
    config.set('server.protocol', 'http')
    config.set('server.sslPassphrase', '')
    config.set('server.sslPrivateKeyPath', '')
    config.set('server.sslCertificatePath', '')

    done()
  })

  after((done) => {
    done()
  })

  it.skip('should respond to a http request when ssl is disabled', (done) => {
    // TODO
  })

  it.skip('should respond to a https request when using unprotected ssl key without a passphrase', (done) => {
    // TODO
  })

  it.skip('should respond to a https request when using protected ssl key with a passphrase', (done) => {
    // TODO
  })

  it.skip('should throw a bad password read exception when using protected ssl key with the wrong passphrase', (done) => {
    // TODO
  })

  it.skip('should throw a bad password read exception when using protected ssl key without a passphrase', (done) => {
    // TODO
  })

})
