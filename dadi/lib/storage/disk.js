var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');
var _ = require('underscore');

var config = require(__dirname + '/../config');

module.exports = function (url) {
  var self = this;

  this.url = url;
  this.path = path.resolve(config.get('images.directory.path'));

  this.getFullUrl = function() {
    return path.join(self.path, self.url.replace('/disk', ''))
  }

  this.get = function () {
    return new Promise(function(resolve, reject) {
      var stream = fs.createReadStream(self.getFullUrl());

      stream.on('open', function () {
        resolve(stream);
      })

      stream.on('error', function() {
        reject('File Not Found');
      })


        // var stats = fs.statSync(url);
        // var fileSize = parseInt(stats["size"]);
        // if(fileSize === 0) {
        //   //return help.displayErrorPage(404, 'File size is 0 byte.', res);
        // }
//        var tmpReadStream = fs.createReadStream(url);
      //   imagesize(tmpReadStream, function(err, imageInfo) {
      //     self.convertAndSave(fsReadStream, imageInfo, originFileName, newFileName, options, returnJSON, res);
      //   });
      // }
      // else {
      //   //help.displayErrorPage(404, 'File "' + url + '" doesn\'t exist.', res);
      // }

	  });
  }
}
