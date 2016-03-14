var should = require('should');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var proxyquire =  require('proxyquire');
var Router = require('router');
var router = Router();

var config;
var cache;
var Server = require(__dirname + '/../../dadi/lib');
var controller = require(__dirname + '/../../dadi/lib/controller');

var testConfigString;

describe('Cache', function (done) {
  beforeEach(function (done) {

    delete require.cache[__dirname + '/../../dadi/lib/cache'];
    cache = require(__dirname + '/../../dadi/lib/cache');

    delete require.cache[__dirname + '/../../config'];
    config = require(__dirname + '/../../config');

    testConfigString = fs.readFileSync(config.configPath());

    done();
  });

  afterEach(function(done) {
    fs.writeFileSync(config.configPath(), testConfigString);
    done();
  });

  it('should export an instance', function (done) {
    cache.should.be.Function;
    done();
  });

  it('should cache if the app\'s directory config settings allow', function (done) {

    var server = sinon.mock(Server);
    server.object.controller = controller(router);

    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.caching.directory.enabled = true;
    newTestConfig.caching.redis.enabled = false;
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    cache = proxyquire('../../dadi/lib/cache', {'config': config});

    cache(server.object.controller.client).enabled.should.eql(true);

    done();
  });

  it('should not cache if the app\'s config settings don\'t allow', function (done) {

    var server = sinon.mock(Server);
    server.object.controller = controller(router);

    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.caching.directory.enabled = false;
    newTestConfig.caching.redis.enabled = false;
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    cache = proxyquire('../../dadi/lib/cache', {'config': config});

    cache(server.object.controller.client).enabled.should.eql(false);

    done();
  });

  it('should cache if the app\'s redis config settings allow', function (done) {

    var server = sinon.mock(Server);
    server.object.controller = controller(router);

    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.caching.directory.enabled = false;
    newTestConfig.caching.redis.enabled = true;
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    cache = proxyquire('../../dadi/lib/cache', {'config': config});

    cache(server.object.controller.client).enabled.should.eql(true);

    done();
  });
});
