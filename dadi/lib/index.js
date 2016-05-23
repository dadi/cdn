var site = require('../../package.json').name;
var version = require('../../package.json').version;
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);
var colors = require('colors');
var bodyParser = require('body-parser');
var finalhandler = require('finalhandler');
var http = require('http');
var path = require('path');
var Router = require('router');
var router = Router();
var _ = require('underscore');

var auth = require(__dirname + '/auth');
var controller = require(__dirname + '/controller');
var configPath = path.resolve(__dirname + '/../../config');
var config = require(configPath);

var Server = function () {

};

Server.prototype.start = function (done) {
  var self = this;

  router.use(bodyParser.json({limit: '50mb'}));

  router.use('/', function(req, res, next) {
    res.end('Welcome to DADI CDN')
  })

  auth(router);

  controller(router);

  var app = http.createServer(function (req, res) {
	config.updateConfigDataForDomain(req.headers.host);

    res.setHeader('Server', config.get('server.name'));
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (config.get('clientCache.cacheControl')) res.setHeader('Cache-Control', config.get('clientCache.cacheControl'));
    if (config.get('clientCache.etag')) res.setHeader('ETag', config.get('clientCache.etag'));

    router(req, res, finalhandler(req, res));
  });

  var server = this.server = app.listen(config.get('server.port'));
  server.on('listening', function() { onListening(this) });

  this.readyState = 1;

  done && done();
};

function onListening(server) {
  var env = config.get('env');
  var address = server.address()

  if (env !== 'test') {
    var startText = '  ----------------------------\n';
    startText += '  Started \'DADI CDN\'\n';
    startText += '  ----------------------------\n';
    startText += '  Server:      '.green + address.address + ':' + address.port + '\n';
    startText += '  Version:     '.green + version + '\n';
    startText += '  Node.JS:     '.green + nodeVersion + '\n';
    startText += '  Environment: '.green + env + '\n';
    startText += '  ----------------------------\n';

    startText += '\n\n  Copyright ' + String.fromCharCode(169) + ' 2015 DADI+ Limited (https://dadi.tech)'.white +'\n';

    console.log(startText)
  }
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
  var self = this;
  this.readyState = 3;

  this.server.close(function (err) {
    self.readyState = 0;
    done && done(err);
  });
};

module.exports = new Server();
