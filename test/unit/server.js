var should = require('should')
var sinon = require('sinon')
var server = require(__dirname + '/../../dadi/lib')
var fs = require('fs')

describe('Server', function () {
  it('should export an instance', function (done) {
    server.start.should.be.Function
    server.stop.should.be.Function
    done()
  })

  describe('start', function () {
    it('should set readyState', function (done) {
      var stub = sinon.stub(fs, 'readdirSync', function () { return []; })

      server.start()

      server.readyState.should.equal(1)
      stub.called.should.be.true
      stub.restore()

      done()
    })
  })

  describe('stop', function () {
    it('should set readyState', function (done) {
      var stub = sinon.stub(server.server, 'close', function (cb) { cb(); })

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
