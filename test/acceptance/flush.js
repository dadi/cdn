var should = require('should');
var request = require('supertest');
var assert = require('assert');
var help = require(__dirname + '/help');
var config = require(__dirname + '/../../config');
var app = require(__dirname + '/../../dadi/lib/');

var bearerToken;

describe('Cache', function () {
  this.timeout(10000)
  describe('Invalidation API', function () {
  beforeEach(function (done) {
    app.start(function() {
      help.getBearerToken(function (err, token) {
        if (err) return done(err);

        bearerToken = token;
        help.clearCache();
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
          .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
          .expect(200)
          .end(function (err, res1) {
            if (err) return done(err);
            res1.headers['x-cache'].should.exist;
            res1.headers['x-cache'].should.eql('MISS');
            done();
          });
      });
    });
  });

  afterEach(function (done) {
    help.clearCache();
    app.stop(done);
  });

  it('should not flush cached items that don\'t match the specified path', function (done) {
    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('MISS');

        client
          .post('/api')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({invalidate: '/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            res.body.result.should.equal('success');

            setTimeout(function() {
              client
                .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err);
                  res.headers['x-cache'].should.exist;
                  res.headers['x-cache'].should.eql('HIT');

                  setTimeout(function() {
                    client
                      .get('/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
                      .expect(200)
                      .end(function (err, res) {
                        if (err) return done(err);
                        res.headers['x-cache'].should.exist;
                        res.headers['x-cache'].should.eql('MISS');
                        done();
                      });
                  }, 500)
                });
            }, 500)
          });
      });
  });

  it('should flush only cached items matching the specified path', function (done) {
    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('MISS');

        client
          .post('/api')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({invalidate: '/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            res.body.result.should.equal('success');
            setTimeout(function() {
              client
                .get('/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err);
                  res.headers['x-cache'].should.exist;
                  res.headers['x-cache'].should.eql('MISS');
                  done();
                });
            }, 500)
          });
      });
  });

  it('should flush all cached items when path is "*"', function (done) {
    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
    client
      .get('/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('MISS');

        client
          .post('/api')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({invalidate: '*'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            res.body.result.should.equal('success');

            setTimeout(function() {
              client
                .get('/jpg/50/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err);
                  res.headers['x-cache'].should.exist;
                  res.headers['x-cache'].should.eql('MISS');

                  setTimeout(function() {
                     client
                      .get('/jpg/70/0/0/801/478/0/0/0/2/aspectfit/North/0/0/0/0/0/test.jpg')
                      .expect(200)
                      .end(function (err, res) {
                        if (err) return done(err);
                        res.headers['x-cache'].should.exist;
                        res.headers['x-cache'].should.eql('MISS');
                        done();
                      });
                  }, 500)
                });
            }, 500)
          });
      });
  });

  it('should return error when no path is specified', function (done) {
    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

    client
      .post('/api')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(400, done);
  });
});
});
