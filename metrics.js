const metrics = require('./metrics.json')
const StatsD = require('node-statsd')
const client = new StatsD()


/*
// Generate random metrics
const rnd    = require('pure-random')

const range = (rmin, rmax, min, max) => {
  const arr = []
  for (var i = 0; i < rnd.random(rnd.genCsSeed(), rmin, rmax).value; i++) {
    arr.push(rnd.random(rnd.genCsSeed(), min, max).value)
  }
  return arr
}

exports.populateMetrics = (n) => {
  const write = require('fs').writeFileSync
  const metrics = []

  var lastDelay = 0
  for (var i = 0; i < n; i++) {
    var metric = {
      'delay': rnd.random(rnd.genCsSeed(), 20, 40).value + lastDelay,
      'http.load': rnd.random(rnd.genCsSeed(), 120, 600).value,
      'http.login.attempts': range(1, 10, 1, 8),
      'http.get.posts': range(3, 7, 50, 4000)
    }
    lastDelay = metric.delay
    metrics.push(metric)
  }

  write('metrics.json', JSON.stringify(metrics, null, 2))
}
*/

exports.send = (done) => {
  metrics.forEach(metric => {
    setTimeout(() => {
      client.gauge('http.load', metric['http.load'])
      client.increment('http.get.posts', metric['http.get.posts'].length)

      metric['http.login.attempts'].forEach(attempt =>
        client.set('http.login.attempts', attempt))
      metric['http.get.posts'].forEach(getPost =>
        client.timing('http.get.posts', getPost))
    }, metric.delay * 1000)
  })

  const closeDelay = (metrics[metrics.length - 1].delay + 5) * 1000  // wait until next flush (5s)
  setTimeout(() => {
    client.close()
    done()
  }, closeDelay)
}
