const path = require('path')
const S3Storage = require(path.join(__dirname, '/s3'))
const DiskStorage = require(path.join(__dirname, '/disk'))
const HTTPStorage = require(path.join(__dirname, '/http'))

const config = require(path.join(__dirname, '/../../../config'))

const ADAPTERS = {
  disk: {
    configBlock: 'directory',
    handler: DiskStorage
  },
  http: {
    configBlock: 'remote',
    handler: HTTPStorage
  },
  s3: {
    configBlock: 's3',
    handler: S3Storage
  }
}

module.exports.create = function create (type, assetPath, {domain} = {}) {
  if (assetPath.indexOf('/') === 0) {
    assetPath = assetPath.slice(1)
  }

  let configBlock = {}

  switch (type) {
    case 'asset':
      configBlock = config.get('assets')

      break

    case 'image':
      configBlock = config.get('images')

      break
  }

  let adapterFromPath = module.exports.extractAdapterFromPath(assetPath)
  let adapter

  if (adapterFromPath.adapter) {
    adapter = adapterFromPath.adapter
    assetPath = adapterFromPath.canonicalPath
  } else {
    if (
      assetPath.indexOf('http:') === 0 ||
      assetPath.indexOf('https:') === 0
    ) {
      adapter = 'http'
    } else {
      let enabledStorage = Object.keys(configBlock).find(key => configBlock[key].enabled)

      adapter = Object.keys(ADAPTERS).find(key => {
        return ADAPTERS[key].configBlock === enabledStorage
      }) || 'disk'
    }
  }

  let Adapter = ADAPTERS[adapter].handler

  return new Adapter({
    assetType: (type === 'image') ? 'images' : 'assets',
    domain,
    url: assetPath
  })
}

module.exports.extractAdapterFromPath = function (assetPath) {
  if (assetPath.indexOf('/') === 0) {
    assetPath = assetPath.slice(1)
  }

  let newAssetPath = assetPath
  let adapter = Object.keys(ADAPTERS).find(key => {
    if (assetPath.indexOf(`${key}/`) === 0) {
      newAssetPath = assetPath.slice(key.length + 1)

      return true
    }
  })

  return {
    adapter,
    canonicalPath: newAssetPath
  }
}
