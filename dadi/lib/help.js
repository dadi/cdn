var path = require('path');
var fs = require('fs');
var config = require(path.resolve(__dirname + '/../../config'));
var cache = require(__dirname + '/cache');

// helper that sends json response
module.exports.sendBackJSON = function (successCode, results, res) {
  res.statusCode = successCode;

  var resBody = JSON.stringify(results);

  res.setHeader('Server', config.get('server.name'));
  res.setHeader('content-type', 'application/json');
  res.setHeader('content-length', Buffer.byteLength(resBody));
  res.setHeader('X-Cache', 'HIT');
  res.end(resBody);
};

module.exports.sendBackJSONP = function (callbackName, results, res) {
  // callback MUST be made up of letters only
  if (!callbackName.match(/^[a-zA-Z]+$/)) return res.send(400);

  res.statusCode = 200;

  var resBody = JSON.stringify(results);
  resBody = callbackName + '(' + resBody + ');';

  res.setHeader('Server', config.get('server.name'));
  res.setHeader('content-type', 'text/javascript');
  res.setHeader('content-length', Buffer.byteLength(resBody));
  res.setHeader('X-Cache', 'HIT');
  res.end(resBody);
};

/**
 * Display Error Page
 * status: status code
 * errorMessage: Error Message to display in the error page.
 */
module.exports.displayErrorPage = function (status, errorMessage, res) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html');
  res.write('<h1>Server Error</h1>');
  res.write('<pre>' + errorMessage + '</pre>');
  res.end();
};

/**
 * Display Unauthorization Error Page
 */
module.exports.displayUnauthorizationError = function (res, message) {
  res.statusCode = 401;
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('WWW-Authenticate', 'Bearer realm="cdn-server"');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Expires', '-1');
  var errorMsg = {
    Error: '401 Unauthorized'
  };
  if(message) {
    errorMsg = {
      Error: message
    };
  }
  res.end(JSON.stringify(errorMsg));
};

module.exports.clearCache = function (pathname, callback) {

  var cachePath = path.join(config.get('caching.directory.path'), pathname);

  // delete using Redis client
  if (cache.client()) {
    setTimeout(function() {
      cache.delete(pathname, function(err) {
        return callback(null);
      });
    }, 200);
  } else {
    var i = 0;
    var exists = fs.existsSync(cachePath);

    if (!exists) {
      return callback(null);
    }
    else {
      if(fs.statSync(cachePath).isDirectory()) {
        var files = fs.readdirSync(cachePath);
        if(files.length === 0) return callback(null);
        files.forEach(function (filename) {
          var file = path.join(cachePath, filename);
          fs.unlinkSync(file);
          i++;
          // finished, all files processed
          if (i == files.length) {
            return callback(null);
          }
        });

      } else {
        fs.unlinkSync(cachePath);
        return callback(null);
      }
    }
  }
};