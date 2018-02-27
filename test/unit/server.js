var path = require('path')
var should = require('should')
var sinon = require('sinon')
var server = require(__dirname + '/../../dadi/lib')
var Server = require(__dirname + '/../../dadi/lib').Server
var fs = require('fs')

describe('Server', function () {
  it('should export an instance', function (done) {
    server.start.should.be.Function
    server.stop.should.be.Function
    done()
  })

  describe('start', function () {
    it('should set readyState', function (done) {
      var stub = sinon.stub(fs, 'readdirSync').callsFake(function () { return [] })

      server.start()

      server.readyState.should.equal(1)
      stub.called.should.be.true
      stub.restore()

      done()
    })
  })

  describe('stop', function () {
    it('should set readyState', function (done) {
      var stub = sinon.stub(server.server, 'close').callsFake(function (cb) { cb() })

      server.stop(function (err) {
        if (err) return done(err)

        server.readyState.should.equal(0)
        stub.called.should.be.true
        stub.restore()

        done()
      })
    })
  })
})
