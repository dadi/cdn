var chokidar = require('chokidar')
var cluster = require('cluster')
var config = require('./config')
var fs = require('fs')
var path = require('path')

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

if (config.get('cluster')) {
  if (cluster.isMaster) {
    var numWorkers = require('os').cpus().length
    console.log('Master cluster setting up ' + numWorkers + ' workers...')

    for (var i = 0; i < numWorkers; i++) {
      cluster.fork()
    }

    cluster.on('online', function (worker) {
      console.log('Worker ' + worker.process.pid + ' is online')
    })

    cluster.on('exit', function (worker, code, signal) {
      console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal)
      console.log('Starting a new worker')
      cluster.fork()
    })

    var watcher = chokidar.watch(process.cwd(), {
      depth: 0,
      ignored: /[\/\\]\./,
      ignoreInitial: true
    })

    watcher.on('add', function (filePath) {
      if (path.basename(filePath) === 'restart.cdn') {
        console.log('Shutdown requested')
        fs.unlinkSync(filePath)
        restartWorkers()
      }
    })
  }else {
    var app = module.exports = require('./dadi/lib')
    app.start(function () {
      console.log('Process ' + process.pid + ' is listening for incoming requests')

      process.on('message', function (message) {
        if (message.type === 'shutdown') {
          console.log('Process ' + process.pid + ' is shutting down...')
          process.exit(0)
        }
      })
    })
  }
} else {
  var app = module.exports = require('./dadi/lib')
  app.start(function () {
    console.log('Process ' + process.pid + ' is listening for incoming requests')
  })
}

function restartWorkers () {
  var wid, workerIds = []

  for (wid in cluster.workers) {
    workerIds.push(wid)
  }

  workerIds.forEach(function (wid) {
    if (cluster.workers[wid]) {
      cluster.workers[wid].send({
        type: 'shutdown',
        from: 'master'
      })

      setTimeout(function () {
        if (cluster.workers[wid]) {
          cluster.workers[wid].kill('SIGKILL')
        }
      }, 5000)
    }
  })
}
