#! /usr/bin/env node

const exec = require('child_process').exec

if (process.env['CI']) {
  exec('cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js', (err, out) => {
    if (err) console.log(err)
  })
}
