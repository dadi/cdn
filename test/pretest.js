const fs = require('fs')
const path = require('path')
const colors = require('colors')

const testConfigPath = './config/config.test.json'
const testConfigSamplePath = './config/config.test.json.sample'

const testConfigSample = fs.readFileSync(testConfigSamplePath, {
  encoding: 'utf-8'
})

function loadConfig() {
  try {
    const testConfig = fs.readFileSync(testConfigPath, {encoding: 'utf-8'})

    return JSON.parse(testConfig)
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.writeFileSync(testConfigPath, testConfigSample)
      console.log()
      console.log("Created file at '" + testConfigPath + "'")
      loadConfig()
    }
  }
}

loadConfig()
