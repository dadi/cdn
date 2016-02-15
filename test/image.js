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
    .then(function(image){
      console.log('Image type', typeof image); 
      return image;
    })
    .then(image.load)
    .then(function(){
      return done();
    }).catch(function(err){
      return done(err);
    });
  });
});
