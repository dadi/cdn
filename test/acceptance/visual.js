const fs = require('fs')
const path = require('path')
const querystring = require('querystring')
const request = require('supertest')
const resemble = require('node-resemble')

const baselineFilePath = path.resolve(path.join(__dirname, '../images/visual/baseline'))
const config = require(__dirname + '/../../config')
const testManifest = require(path.resolve(path.join(__dirname, 'visual_manifest.json')))

const cdnClient = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
let app

require('it-each')({ testPerIteration: true })

describe('Visual Regression', function (done) {
  this.timeout(10000)

  before(function (done) {
    delete require.cache[require.resolve(__dirname + '/../../dadi/lib/')]
    app = require(__dirname + '/../../dadi/lib/')

    app.start(function (err) {
      if (err) {
        return done()
      }

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done()
      }, 500)
    })
  })

  after(function (done) {
    app.stop(done)
  })

  it.each(testManifest.tests, 'Test', ['baselineFilename'], function (element, next) {
    requestTestImage(element)
    .then(() => {
      next()
    })
    .catch(err => {
      next(err)
    })
  })
})

function requestTestImage (test) {
  return new Promise((resolve, reject) => {
    const testFilePath = path.join(testManifest.path, test.image)
    const requestPath = '/' + testFilePath + '?' + querystring.encode(test.params)

    const baselineImage = fs.readFileSync(path.join(__dirname, '../', test.baselineFilename))

    cdnClient
    .get(requestPath)
    .end(function (err, res) {
      if (err) return reject(err)
      if (res.error) return reject(res.error)

      if (res && res.body) {
        const diff = resemble(baselineImage).compareTo(res.body).ignoreColors().onComplete(data => {
          if (!data.isSameDimensions || data.rawMisMatchPercentage > testManifest.threshold) {
            let error = new Error('Image mismatch: ' + JSON.stringify(data))
            error.data = data
            return reject(error)
          }

          return resolve()
        })
        /*
        {
          misMatchPercentage : 100, // %
          isSameDimensions: true, // or false
          getImageDataUrl: function(){} // returns base64-encoded image
          pngStream: function(){} // returns stream with image data
          getBuffer: function(cb){} // calls callback with image buffer
        }
        */
      }
    })
  })
}

