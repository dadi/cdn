const config = require(__dirname + '/../../config')
const fs = require('fs')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const stream = require('stream')

const ImageHandler = require(__dirname + '/../../dadi/lib/handlers/image')

describe('Plugins', done => {
  describe('post-processing', () => {
    it('should receive the correct parameters', done => {
      const req = {
        url: '/test.jpg?width=350&height=530&resizeStyle=entropy'
      }

      let pluginParameters = {}

      const pluginPost = parameters => {
        pluginParameters = parameters
      }
      const handler = new ImageHandler('jpg', req)

      sinon.stub(handler.storageFactory, 'create').returns({
        get: () => {
          const readable = new fs.createReadStream(
            path.join(path.resolve(config.get('images.directory.path')), '/test.jpg')
          )

          return Promise.resolve(readable)        
        }
      })

      handler.plugins = [{
        post: pluginPost
      }]

      handler.get().then(response => {
        handler.storageFactory.create.restore()

        pluginParameters.assetStore.should.be.Function

        pluginParameters.cache.get.should.be.Function
        pluginParameters.cache.set.should.be.Function

        pluginParameters.imageInfo.format.should.eql('jpg')
        pluginParameters.imageInfo.width.should.eql(350)
        pluginParameters.imageInfo.height.should.eql(530)
        pluginParameters.imageInfo.naturalWidth.should.be.Number
        pluginParameters.imageInfo.naturalHeight.should.be.Number

        pluginParameters.options.format.should.eql('jpg')
        pluginParameters.options.width.should.eql(350)
        pluginParameters.options.height.should.eql(530)
        pluginParameters.options.height.should.eql(530)
        pluginParameters.options.resizeStyle.should.eql('entropy')

        pluginParameters.processor.constructor.name.should.eql('Sharp')

        pluginParameters.sharp.should.be.Function

        pluginParameters.url.should.eql(req.url)

        done()
      })
    })
  })
})
