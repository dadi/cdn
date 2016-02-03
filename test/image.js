var gd = require('node-gd');
var image = require('../dadi/lib/image/index.js')();
var fs = require('fs');
var assert = require('chai').assert;

var img = fs.readFileSync('test/apple.jpg');

describe('Image Library', function(){
  it('Should load an image', function(done){
    image.load(img, 'jpg')
    .then(function(image){
      assert(image instanceof gd.Image, 'return image');
      return done();
    })
    .catch(done);
  });
});
