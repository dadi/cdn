var gd = require('node-gd');
var image = require('../dadi/lib/image/index.js')();
var fs = require('fs');
var assert = require('chai').assert;

var img = fs.readFileSync('test/apple.jpg');

describe('Image Library', function(){
  var testImagePtr = null;
  it('Should load an image', function(done){
    image.load(img)
    .then(function(image){
      assert(image instanceof gd.Image, 'return image');
      testImagePtr = image;
      return done();
    })
    .catch(done);
  });
  it('Should save the image as a png', function(done){
    image.save(testImagePtr, 'png')
    .then(image.load)
    .then(function(){
      return done();
    }).catch(done);
  });
  it('Should test several of the filters and save the image to disk', function(done){
    image.load(img)
    .then(image.flip)
    .then(function(img){ return image.blur(img, 10); })
    .then(function(img){ return image.crop(img, 0, 0, 250); })
    .then(function(img){ return image.save(img, 'png'); })
    .then(function(img){ return fs.writeFileSync('./results.png', img, 'ascii'); })
    .then(done)
    .catch(done);
  });
});
