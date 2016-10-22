var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var request = require('supertest')

var cache = require(__dirname + '/../../dadi/lib/cache')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')

var testConfig

describe('Index', function () {

  before(function (done) {
    testConfig = JSON.parse(fs.readFileSync(config.configPath()).toString())

    app.start(function (err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done()
      }, 500)
    })
  })

  after(function (done) {
    app.stop(function() {
      fs.writeFileSync(config.configPath(), JSON.stringify(testConfig, null, 2))
      done()
    })
  })

  describe('File change monitor', function () {
    it('should reload the config when the current config file changes', function (done) {

      var configContent = JSON.parse(fs.readFileSync(config.configPath()).toString())

      configContent.logging.level = 'trace'

      fs.writeFileSync(config.configPath(), JSON.stringify(configContent, null, 2))

      // reload
      setTimeout(function() {
        config = require(__dirname + '/../../config')
        config.get('logging.level').should.eql('trace')
        done()
      }, 1000)
    })
  })
})