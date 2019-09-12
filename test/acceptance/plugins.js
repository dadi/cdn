const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const fs = require('fs')
const help = require('./help')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')
const stream = require('stream')

const cdnUrl = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`
const ImageHandler = require(__dirname + '/../../dadi/lib/handlers/image')
const workspace = require(__dirname + '/../../dadi/lib/models/workspace')

const appActions = {
  start: done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 500)
    })
  },

  stop: done => app.stop(done)
}

describe('Plugins', function(done) {
  this.timeout(15000)

  describe('pre-processing', () => {
    it('should modify the options before the image is processed', done => {
      help.createTempFile(
        'workspace/plugins/test-plugin-one.js',
        `module.exports.pre = parameters => { parameters.options.saturate = -100 }`,
        done1 => {
          help.createTempFile(
            'workspace/recipes/test-recipe-with-plugin.json',
            {
              recipe: 'test-recipe-with-plugin',
              plugins: ['test-plugin-one']
            },
            done2 => {
              appActions.start(() => {
                help
                  .imagesEqual({
                    base:
                      'test/images/visual/baseline/measure.png?saturate=0.png',
                    test: `${cdnUrl}/test-recipe-with-plugin/visual/measure1.png`
                  })
                  .then(match => {
                    match.should.eql(true)

                    appActions.stop(() => {
                      done2()
                      done1()
                      done()
                    })
                  })
              })
            }
          )
        }
      )
    })
  })

  describe('post-processing', () => {
    it("should modify the image before it's sent to the client", done => {
      help.createTempFile(
        'workspace/plugins/test-plugin-one.js',
        `module.exports.post = parameters => { parameters.processor.greyscale() }`,
        done1 => {
          help.createTempFile(
            'workspace/recipes/test-recipe-with-plugin.json',
            {
              recipe: 'test-recipe-with-plugin',
              plugins: ['test-plugin-one']
            },
            done2 => {
              appActions.start(() => {
                help
                  .imagesEqual({
                    base:
                      'test/images/visual/baseline/measure.png?saturate=0.png',
                    test: `${cdnUrl}/test-recipe-with-plugin/visual/measure1.png`
                  })
                  .then(match => {
                    match.should.eql(true)

                    appActions.stop(() => {
                      done2()
                      done1()
                      done()
                    })
                  })
              })
            }
          )
        }
      )
    })
  })

  describe('controller', () => {
    it('should return the stream to be sent to the client', done => {
      help.createTempFile(
        'workspace/plugins/test-controller-plugin-one.js',
        `module.exports = parameters => {
          return parameters.assetStore('image', 'test.jpg').get()
        }`,
        done1 => {
          appActions.start(() => {
            help
              .imagesEqual({
                base: 'test/images/test.jpg',
                test: `${cdnUrl}/test-controller-plugin-one`
              })
              .then(match => {
                match.should.eql(true)

                appActions.stop(() => {
                  done1()
                  done()
                })
              })
          })
        }
      )
    })

    it('should be able to set response headers', done => {
      help.createTempFile(
        'workspace/plugins/test-controller-plugin-two.js',
        `module.exports = parameters => {
          parameters.setHeader('content-type', 'image/png')
          parameters.setHeader('x-cache', 'HIT')

          return parameters.assetStore('image', 'test.jpg').get()
        }`,
        done1 => {
          appActions.start(() => {
            request(cdnUrl)
              .get('/test-controller-plugin-two')
              .expect(500)
              .end((err, res) => {
                res.headers['content-type'].should.eql('image/png')
                res.headers['x-cache'].should.eql('HIT')

                appActions.stop(() => {
                  done1()
                  done()
                })
              })
          })
        }
      )
    })

    it('should respond with a 500 if the plugin throws any errors', done => {
      help.createTempFile(
        'workspace/plugins/test-controller-plugin-three.js',
        `module.exports = parameters => {
          iDoNotExist()
        }`,
        done1 => {
          appActions.start(() => {
            request(cdnUrl)
              .get('/test-controller-plugin-three')
              .expect(500, () => {
                appActions.stop(() => {
                  done1()
                  done()
                })
              })
          })
        }
      )
    })
  })
})
