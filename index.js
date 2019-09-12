const chokidar = require('chokidar')
const cluster = require('cluster')
const config = require('./config')
const fs = require('fs')
const path = require('path')

// Console start message
const dadiBoot = require('@dadi/boot')

dadiBoot.start(require('./package.json'))

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

if (config.get('cluster')) {
  if (cluster.isMaster) {
    const numWorkers = require('os').cpus().length

    console.log('Master cluster setting up ' + numWorkers + ' workers...')

    for (let i = 0; i < numWorkers; i++) {
      cluster.fork()
    }

    cluster.on('online', function(worker) {
      console.log('Worker ' + worker.process.pid + ' is online')
    })

    cluster.on('exit', function(worker, code, signal) {
      console.log(
        'Worker ' +
          worker.process.pid +
          ' died with code: ' +
          code +
          ', and signal: ' +
          signal
      )
      console.log('Starting a new worker')
      cluster.fork()
    })

    const watcher = chokidar.watch(process.cwd(), {
      depth: 0,
      ignored: /[/\\]\./,
      ignoreInitial: true
    })

    watcher.on('add', function(filePath) {
      if (path.basename(filePath) === 'restart.cdn') {
        console.log('Shutdown requested')
        fs.unlinkSync(filePath)
        restartWorkers()
      }
    })
  } else {
    const app = (module.exports = require('./dadi/lib'))

    app.start(function() {
      console.log(
        'Process ' + process.pid + ' is listening for incoming requests'
      )

      process.on('message', function(message) {
        if (message.type === 'shutdown') {
          console.log('Process ' + process.pid + ' is shutting down...')
          process.exit(0)
        }
      })
    })
  }
} else {
  const app = (module.exports = require('./dadi/lib'))

  app.start(function() {
    console.log(
      'Process ' + process.pid + ' is listening for incoming requests'
    )
  })
}

function restartWorkers() {
  let wid
  const workerIds = []

  for (wid in cluster.workers) {
    workerIds.push(wid)
  }

  workerIds.forEach(function(wid) {
    if (cluster.workers[wid]) {
      cluster.workers[wid].send({
        type: 'shutdown',
        from: 'master'
      })

      setTimeout(function() {
        if (cluster.workers[wid]) {
          cluster.workers[wid].kill('SIGKILL')
        }
      }, 5000)
    }
  })
}
