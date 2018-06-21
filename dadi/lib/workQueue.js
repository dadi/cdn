const WorkQueue = function (multiplexFn) {
  this.multiplexFn = multiplexFn || (i => i)
  this.jobs = {}
}

WorkQueue.prototype.run = function (key, jobFn) {
  if (!this.jobs[key]) {
    this.jobs[key] = {
      fn: jobFn().then(result => {
        let job = this.jobs[key]
        let subscribers = job.subscribers || []

        delete this.jobs[key]

        subscribers.forEach(subscriber => {
          let subscriberResult = this.multiplexFn(result)

          subscriber(subscriberResult)
        })
      }).catch(console.log)
    }
  }

  return this.subscribe(key)
}

WorkQueue.prototype.subscribe = function (key) {
  return new Promise((resolve, reject) => {
    this.jobs[key].subscribers = this.jobs[key].subscribers || []
    this.jobs[key].subscribers.push(
      result => resolve(result)
    )
  })
}

module.exports = WorkQueue
