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

Server.prototype.start = function (options, done) {
  var self = this;

  router.use(bodyParser.json({limit: '50mb'}));

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

  app.listen(config.get('server.port'));

  done && done();
};

module.exports = new Server();
