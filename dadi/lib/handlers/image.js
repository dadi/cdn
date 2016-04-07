var config = require(__dirname + '/../../../config');

var ImageHandler = function (format, url) {
  var self = this;

  // this.url = nodeUrl.parse(url, true).pathname;
  // this.path = path.resolve(config.get('images.directory.path'));

  // this.getFullUrl = function() {
  //   return path.join(self.path, self.url.replace('/disk', ''))
  // }
}

ImageHandler.prototype.get = function () {
  var self = this;

  // return new Promise(function(resolve, reject) {
  //   // attempt to open
  //   var stream = fs.createReadStream(self.getFullUrl());
  //
  //   stream.on('open', function () {
  //     // check file size
  //     var stats = fs.statSync(self.getFullUrl());
  //     var fileSize = parseInt(stats.size);
  //
  //     if (fileSize === 0) {
  //       var err = {
  //         statusCode: 404,
  //         message: 'File size is 0 bytes'
  //       }
  //
  //       return reject(err);
  //     }
  //
  //     return resolve(stream);
  //   })
  //
  //   stream.on('error', function() {
  //     var err = {
  //       statusCode: 404,
  //       message: 'File not found'
  //     }
  //
  //     return reject(err);
  //   })
  // })
}

module.exports = function (format, url) {
  return new ImageHandler(format, url);
}

module.exports.ImageHandler = ImageHandler;
