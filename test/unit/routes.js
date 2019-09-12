const config = require(__dirname + '/../../config')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const Route = require(__dirname + '/../../dadi/lib/models/route')
const fs = require('fs')

let sampleRoute

describe('Routes model', () => {
  beforeEach(() => {
    sampleRoute = {
      route: 'sample-route',
      branches: [
        {
          condition: {
            device: 'desktop',
            language: 'en',
            network: 'cable'
          },
          recipe: 'thumbnail'
        },
        {
          recipe: 'default-recipe'
        }
      ]
    }
  })

  describe('`_arrayIntersect` method', () => {
    it('should return false if the first argument is falsy', () => {
      const route = new Route(sampleRoute)

      route._arrayIntersect(null, [1, 2, 3, 4, 5]).should.eql(false)
    })

    it('should receive two arrays and return true if there is at least one common element', () => {
      const route = new Route(sampleRoute)
      const array1 = [1, 2, 3, 4, 5]
      const array2 = [4, 5, 6, 7]
      const array3 = [7]
      const array4 = ['one', 'two', 'three']
      const array5 = ['three', 'four']

      route._arrayIntersect(array1, array2).should.eql(true)
      route._arrayIntersect(array2, array3).should.eql(true)
      route._arrayIntersect(array1, array3).should.eql(false)
      route._arrayIntersect(array1, array4).should.eql(false)
      route._arrayIntersect(array4, array5).should.eql(true)
    })

    it("should transform the first argument in an array if it isn't one", () => {
      const route = new Route(sampleRoute)

      route._arrayIntersect('one', ['one', 'two']).should.eql(true)
    })
  })

  describe('`_getCacheKey` method', () => {
    it('should return a key comprised of the concatenation of the IP and the name of the route', () => {
      const route = new Route(sampleRoute)

      route.ip = '123.456.78.9'

      route._getCacheKey().should.eql([undefined, route.ip + sampleRoute.route])
    })
  })

  describe('`_getPathInObject` method', () => {
    it('should return a value located at the path described by the `path` argument', () => {
      const route = new Route(sampleRoute)

      route
        ._getPathInObject('branches.0.condition.network', sampleRoute)
        .should.eql(sampleRoute.branches[0].condition.network)
    })
  })

  describe('`_matchBranch` method', () => {
    it('should return true if the branch has no conditions', () => {
      const route = new Route(sampleRoute)

      return route._matchBranch(sampleRoute.branches[1]).then(match => {
        match.should.eql(true)
      })
    })

    it('should return true/false based on whether the branch matches a `device` condition', () => {
      sampleRoute.branches = [
        {
          condition: {
            device: 'mobile'
          },
          recipe: 'recipe-one'
        },
        {
          recipe: 'recipe-two'
        }
      ]

      const route1 = new Route(sampleRoute)
      const route2 = new Route(sampleRoute)

      sinon.stub(route1, 'getDevice').returns('mobile')
      sinon.stub(route2, 'getDevice').returns('desktop')

      return route1
        ._matchBranch(sampleRoute.branches[0])
        .then(match => {
          route1.getDevice.restore()

          match.should.eql(true)

          return route2._matchBranch(sampleRoute.branches[0])
        })
        .then(match => {
          route2.getDevice.restore()

          match.should.eql(false)
        })
    })

    it('should return true/false based on whether the branch matches a `language` condition', () => {
      sampleRoute.branches = [
        {
          condition: {
            language: ['en', 'pt'],
            languageMinQuality: 0.5
          },
          recipe: 'recipe-one'
        },
        {
          recipe: 'recipe-two'
        }
      ]

      const sampleRoute2 = Object.assign({}, sampleRoute, {
        branches: [
          {
            condition: {
              language: 'en'
            }
          }
        ]
      })

      const route1 = new Route(sampleRoute)
      const route2 = new Route(sampleRoute)
      const route3 = new Route(sampleRoute)
      const route4 = new Route(sampleRoute2)
      const route5 = new Route(sampleRoute2)

      route1.language = 'de,pt;q=0.8'
      route2.language = 'de,pt;q=0.3'
      route3.language = 'en,de;q=0.8'
      route4.language = 'pt,en;q=0.8'
      route5.language = 'en'

      return Promise.all([
        route1._matchBranch(sampleRoute.branches[0]),
        route2._matchBranch(sampleRoute.branches[0]),
        route3._matchBranch(sampleRoute.branches[0]),
        route4._matchBranch(sampleRoute2.branches[0]),
        route5._matchBranch(sampleRoute2.branches[0])
      ]).then(matches => {
        matches[0].should.eql(true)
        matches[1].should.eql(false)
        matches[2].should.eql(true)
        matches[3].should.eql(false)
        matches[4].should.eql(true)
      })
    })

    it('should return true/false based on whether the branch matches a `country` condition', () => {
      const branch1 = {
        condition: {
          country: ['GB', 'US']
        },
        recipe: 'recipe-one'
      }
      const branch2 = {
        condition: {
          country: 'US'
        },
        recipe: 'recipe-one'
      }

      const route1 = new Route(sampleRoute)
      const route2 = new Route(sampleRoute)

      sinon.stub(route1, 'getLocation').returns(Promise.resolve('PT'))
      sinon.stub(route2, 'getLocation').returns(Promise.resolve('US'))

      return Promise.all([
        route1._matchBranch(branch1),
        route2._matchBranch(branch2)
      ]).then(matches => {
        route1.getLocation.restore()
        route2.getLocation.restore()

        matches[0].should.eql(false)
        matches[1].should.eql(true)
      })
    })

    it('should return true/false based on whether the branch matches a `network` condition', () => {
      const branch1 = {
        condition: {
          network: ['cable', 'dsl']
        },
        recipe: 'recipe-one'
      }
      const branch2 = {
        condition: {
          network: 'mobile'
        },
        recipe: 'recipe-one'
      }

      const route1 = new Route(sampleRoute)
      const route2 = new Route(sampleRoute)

      sinon.stub(route1, 'getNetwork').returns(Promise.resolve('mobile'))
      sinon.stub(route2, 'getNetwork').returns(Promise.resolve('mobile'))

      return Promise.all([
        route1._matchBranch(branch1),
        route2._matchBranch(branch2)
      ]).then(matches => {
        route1.getNetwork.restore()
        route2.getNetwork.restore()

        matches[0].should.eql(false)
        matches[1].should.eql(true)
      })
    })
  })

  describe('`evaluateBranches` method', () => {
    it('should return false if no branches are supplied', () => {
      const route = new Route(sampleRoute)

      return route.evaluateBranches([]).then(result => {
        result.should.eql(false)
      })
    })

    it('should return the first branch that is a match', () => {
      const branches = [
        {
          condition: {
            country: ['GB', 'US']
          },
          recipe: 'recipe-one'
        },
        {
          condition: {
            country: ['PT', 'ES']
          },
          recipe: 'recipe-two'
        },
        {
          recipe: 'recipe-three'
        }
      ]

      const route1 = new Route(sampleRoute)
      const route2 = new Route(sampleRoute)
      const route3 = new Route(sampleRoute)

      sinon.stub(route1, 'getLocation').returns(Promise.resolve('GB'))
      sinon.stub(route2, 'getLocation').returns(Promise.resolve('ES'))
      sinon.stub(route3, 'getLocation').returns(Promise.resolve('DE'))

      return Promise.all([
        route1.evaluateBranches(branches),
        route2.evaluateBranches(branches),
        route3.evaluateBranches(branches)
      ]).then(matches => {
        route1.getLocation.restore()
        route2.getLocation.restore()
        route3.getLocation.restore()

        matches[0].should.eql(branches[0])
        matches[1].should.eql(branches[1])
        matches[2].should.eql(branches[2])
      })
    })
  })

  describe('`getLocation` method', () => {
    it('should return a rejected Promise if Geolocation is not enabled in config', () => {
      const configBackup = config.get('geolocation.enabled')

      config.set('geolocation.enabled', false)

      const route = new Route(sampleRoute)

      return route.getLocation().catch(error => {
        config.set('geolocation.enabled', configBackup)

        error.should.eql('Geolocation is not enabled')
      })
    })

    it('should use Maxmind as the Geolocation method', () => {
      const configBackup = {
        enabled: config.get('geolocation.enabled'),
        method: config.get('geolocation.method')
      }

      config.set('geolocation.enabled', true)
      config.set('geolocation.method', 'maxmind')

      const route = new Route(sampleRoute)

      sinon.stub(route, 'getMaxmindLocation').returns(Promise.resolve(true))

      return route.getLocation().then(response => {
        route.getMaxmindLocation.restore()

        Object.keys(configBackup).forEach(key => {
          config.set(`geolocation.${key}`, configBackup[key])
        })

        response.should.eql(true)
      })
    })

    it('should use remote as the Geolocation method', () => {
      const configBackup = {
        enabled: config.get('geolocation.enabled'),
        method: config.get('geolocation.method')
      }

      config.set('geolocation.enabled', true)
      config.set('geolocation.method', 'remote')

      const route = new Route(sampleRoute)

      sinon.stub(route, 'getRemoteLocation').returns(Promise.resolve(true))

      return route.getLocation().then(response => {
        route.getRemoteLocation.restore()

        Object.keys(configBackup).forEach(key => {
          config.set(`geolocation.${key}`, configBackup[key])
        })

        response.should.eql(true)
      })
    })

    it('should return a rejected Promise if the Geolocation method is invalid', () => {
      const configBackup = {
        enabled: config.get('geolocation.enabled'),
        method: config.get('geolocation.method')
      }

      config.set('geolocation.enabled', true)
      config.set('geolocation.method', 'invalidMethod')

      const route = new Route(sampleRoute)

      return route.getLocation().catch(error => {
        Object.keys(configBackup).forEach(key => {
          config.set(`geolocation.${key}`, configBackup[key])
        })

        error.should.eql('Invalid geolocation method')
      })
    })
  })

  describe('`processRoute` method', () => {
    it('should return the first branch that is a match', () => {
      const branches = [
        {
          condition: {
            country: ['GB', 'US']
          },
          recipe: 'recipe-one'
        },
        {
          condition: {
            country: ['PT', 'ES']
          },
          recipe: 'recipe-two'
        },
        {
          recipe: 'recipe-three'
        }
      ]

      const route1 = new Route(sampleRoute)
      const route2 = new Route(sampleRoute)
      const route3 = new Route(sampleRoute)

      sinon
        .stub(route1, 'evaluateBranches')
        .returns(Promise.resolve(branches[0]))
      sinon
        .stub(route2, 'evaluateBranches')
        .returns(Promise.resolve(branches[1]))
      sinon
        .stub(route3, 'evaluateBranches')
        .returns(Promise.resolve(branches[2]))

      return Promise.all([
        route1.processRoute(),
        route2.processRoute(),
        route3.processRoute()
      ]).then(matches => {
        route1.evaluateBranches.restore()
        route2.evaluateBranches.restore()
        route3.evaluateBranches.restore()

        matches[0].should.eql(branches[0].recipe)
        matches[1].should.eql(branches[1].recipe)
        matches[2].should.eql(branches[2].recipe)
      })
    })
  })

  describe('`setIP` method', () => {
    it("should save an internal reference of the client's IP", () => {
      const route = new Route(sampleRoute)
      const ip = '123.456.78.9'

      should.not.exist(route.ip)

      route.setIP(ip)

      route.ip.should.eql(ip)
    })
  })

  describe('`setLanguage` method', () => {
    it("should save an internal reference of the client's language header", () => {
      const route = new Route(sampleRoute)
      const language = 'de,pt;q=0.8'

      should.not.exist(route.language)

      route.setLanguage(language)

      route.language.should.eql(language)
    })
  })

  describe('`setUserAgent` method', () => {
    it("should save an internal reference of the client's user agent", () => {
      const route = new Route(sampleRoute)
      const userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8'

      should.not.exist(route.userAgent)

      route.setUserAgent(userAgent)

      route.userAgent.should.eql(userAgent)
    })
  })
})
