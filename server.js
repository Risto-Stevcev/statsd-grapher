const express = require('express')
const R = require('ramda')
    , U = require('./src/utils')
const app = express()

var stats = {}
var flushCount = 0
const per = {
  hour: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7
}

app.use(express.static(__dirname + '/public'))

app.set('views', './views')
app.set('view engine', 'jade')


exports.init = function(startupTime, config, events) {
  per.hour /= (config.flushInterval || 10000) / 1000
  per.week /= (config.flushInterval || 10000) / 1000

  events.on('flush', function(timestamp, metrics) {
    timestamp *= 1000  // unix time

    if (flushCount === per.week) {
      stats = {}
      flushCount = 0
    } else {
      flushCount++
    }

    const newStats = U.setStats(timestamp, metrics, stats)
    stats = newStats
  })

  app.get('/stats', function (req, res) {
    if (config.tokens && R.contains(req.query.token, config.tokens))
      res.render('stats', stats)
    else
      res.status(401).send('401: Unauthorized')
  })

  app.listen(config.expressPort || 3000, function () {
    console.log(`Express listening on port: ${config.expressPort || 3000}`)
  })

  return true
}
