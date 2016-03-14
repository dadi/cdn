var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');
var fs = require('fs');

var testConfigString;

describe('Authentication', function () {
  var tokenRoute = config.get('auth.tokenUrl');

  beforeEach(function (done) {
    delete require.cache[__dirname + '/../../config'];
    config = require(__dirname + '/../../config');

    testConfigString = fs.readFileSync(config.configPath());

    app.start(function (err) {
      if (err) return done(err);

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        done();
      }, 500);
    });
  });

  afterEach(function (done) {
    help.clearCache();
    app.stop(done);
  });

  it('should handle test image if image uri is valid', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = true;
    newTestConfig.images.directory.path = './test/images';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(200, done);
  });

  it('should return error if image uri is invalid', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = true;
    newTestConfig.images.directory.path = './test/images';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/jpg/50/0/0/801/478/0/0/0/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(404, done);
  });

  it('should get image from cache if cache is enabled and cached item exist ', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = true;
    newTestConfig.images.directory.path = './test/images';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(200, function(err, res) {
        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('MISS');

        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
        client
          .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
          .expect(200, function(err, res) {
            res.headers['x-cache'].should.exist;
            res.headers['x-cache'].should.eql('HIT');
            done();
          });
      });
  });

  it('should handle image if recipe is valid ', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = true;
    newTestConfig.images.directory.path = './test/images';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/test_recipe/test.jpg')
      .expect(200, done);
  });

  it('should return error if recipe is invalid ', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.images.directory.enabled = true;
    newTestConfig.images.directory.path = './test/images';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/wrong_test_recipe/test.jpg')
      .expect(404, done);
  });

  it('should handle test assets file if uri is valid', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.assets.directory.enabled = true;
    newTestConfig.assets.directory.path = './test/assets';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/js/0/test.js')
      .expect(200, function(err, res) {
        res.should.exist;
        client
          .get('/js/1/test.js')
          .expect(200, function(err, res) {
            res.should.exist;
            client
              .get('/css/0/test.css')
              .expect(200, function(err, res) {
                res.should.exist;
                client
                  .get('/css/1/test.css')
                  .expect(200, function(err, res) {
                    res.should.exist;
                    client
                      .get('/fonts/test.ttf')
                      .expect(200, function(err, res) {
                        res.should.exist;
                        done();
                      });
                  });
              });
          });
      });
  });

  it('should return error if compress parameter is not 0 or 1', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.assets.directory.enabled = true;
    newTestConfig.assets.directory.path = './test/assets';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/js/2/test.js')
      .expect(404, done);
  });

  it('should return error if font file type is not TTF, OTF, WOFF, SVG or EOT', function(done) {
    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.assets.directory.enabled = true;
    newTestConfig.assets.directory.path = './test/assets';
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    config.loadFile(config.configPath());

    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/fonts/test.bad')
      .expect(404, done);
  });


});
