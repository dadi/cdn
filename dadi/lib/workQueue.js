const WorkQueue = function(multiplexFn) {
  this.multiplexFn = multiplexFn || (i => i)
  this.jobs = {}
}

WorkQueue.prototype.processJobResult = function(key, error, result) {
  const job = this.jobs[key]
  const subscribers = job.subscribers || []

  delete this.jobs[key]

  subscribers.forEach(subscriber => {
    if (error) {
      subscriber(error)
    } else {
      const subscriberResult = this.multiplexFn(result)

      subscriber(null, subscriberResult)
    }
  })
}

WorkQueue.prototype.run = function(key, jobFn) {
  if (!this.jobs[key]) {
    this.jobs[key] = {
      fn: jobFn()
        .then(result => {
          this.processJobResult(key, null, result)
        })
        .catch(error => {
          this.processJobResult(key, error)
        })
    }
  }

  return this.subscribe(key)
}

WorkQueue.prototype.subscribe = function(key) {
  return new Promise((resolve, reject) => {
    this.jobs[key].subscribers = this.jobs[key].subscribers || []
    this.jobs[key].subscribers.push((err, result) => {
      if (err) {
        return reject(err)
      }

      resolve(result)
    })
  })
}

module.exports = WorkQueue
