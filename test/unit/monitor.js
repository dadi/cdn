var should = require('should')
var monitor = require(__dirname + '/../../dadi/lib/monitor')
var config = require(__dirname + '/../../config')
var EventEmitter = require('events').EventEmitter
var fs = require('fs')

describe.skip('Monitor', function () {
  afterEach(function (done) {
    delete require.cache[__dirname + '/../../dadi/lib/monitor']
    monitor = require(__dirname + '/../../dadi/lib/monitor')
    done()
  })

  it('should export constructor', function (done) {
    monitor.Monitor.should.be.Function
    done()
  })

  it('should export a function that returns an instance', function (done) {
    var watch = monitor(__dirname)
    watch.should.be.an.instanceOf(monitor.Monitor)
    watch.close()
    done()
  })

  it('should inherit from Event Emitter', function (done) {
    var watch = monitor(__dirname)
    watch.should.be.an.instanceOf(EventEmitter)
    watch.close()
    done()
  })

  it('should accept a path as first argument', function (done) {
    var watch = monitor(__dirname)
    watch.path.should.equal(__dirname)
    watch.close()
    done()
  })

  it('should require a path as first argument', function (done) {
    monitor.should.throw()
    done()
  })

  it('should have `close` method', function (done) {
    var watch = monitor(__dirname)
    watch.close.should.be.Function
    watch.close()
    done()
  })

  describe('file system watching', function () {
    var testfile = 'testfile.txt'
    var testfilePath = __dirname + '/' + testfile

    afterEach(function (done) {
      fs.unlinkSync(testfilePath)
      done()
    })

    it('should be able to watch for new files in a directory', function (done) {
      var watch = monitor(__dirname)
      watch.on('change', function (filename) {
        filename.should.equal(testfile)
        watch.close()
        done()
      })

      fs.writeFileSync(testfilePath, 'Foo Bar Baz Qux')
    })

    it('should be able to watch for changes to existing files', function (done) {
      fs.writeFileSync(testfilePath, 'Foo Bar Baz')

      var watch = monitor(__dirname)
      watch.on('change', function (filename) {
        filename.should.equal(testfile)
        watch.close()
        done()
      })

      fs.appendFileSync(testfilePath, ' Qux')
    })
  })
})
