var AWS = require('aws-sdk');
var Promise = require('bluebird');
var stream = require('stream');
var _ = require('underscore');

var config = require(__dirname + '/../config');

AWS.config.setPromisesDependency(require('bluebird'));
AWS.config.update({
  accessKeyId: config.get('images.s3.accessKey'),
  secretAccessKey: config.get('images.s3.secretKey')
});

if (config.get('images.s3.region') && config.get('images.s3.region') != "") {
  AWS.config.update({
    region: config.get('images.s3.region')
  });
}

module.exports = function (url) {
  var self = this;

  this.url = url;
  this.s3 = new AWS.S3();

  this.urlParts = function() {
    return this.url.replace('/s3', '').split('/')
  }

  this.get = function () {
    return new Promise(function(resolve, reject) {
      var urlParts = _.compact(self.urlParts());

      if (urlParts.length < 2) {
        reject('No Bucket Provided')
      }

      // create the AWS.Request object
      var request = self.s3.getObject({
        Bucket: urlParts.shift(),
        Key: urlParts.join('/')
      });

      var promise = request.promise();

      promise.then(
        function (data) {
          var bufferStream = new stream.PassThrough();
          bufferStream.end(data.Body)
          resolve(bufferStream);
        },
        function (error) {
          reject(error);
        }
      )
	  });
  }
}
