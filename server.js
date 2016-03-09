const express = require('express')
const R = require('ramda')
    , U = require('./src/utils')
const app = express()

var stats = {}
//const stats = { counters: {}, timers: {}, gauges: {}, counter_rates: {}, sets: {} }
const per = {
  hour: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7
}

app.use(express.static(__dirname + '/public'))

app.set('views', './views')
app.set('view engine', 'jade')


/*
const max = arr => arr.reduce((a,b) => Math.max(a,b), 0)
const min = arr => arr.reduce((a,b) => Math.min(a,b), Infinity)
const avg = arr => arr.reduce((a,b) => a+b, 0) / arr.length
*/

exports.init = function(startupTime, config, events) {
  per.hour /= (config.flushInterval || 10000) / 1000
  per.week /= (config.flushInterval || 10000) / 1000

  events.on('flush', function(timestamp, metrics) {
    if (stats.length === per.week)
      stats.length.shift()

    timestamp *= 1000  // unix time

    const newStats = U.setStats(timestamp, metrics, stats)
    stats = newStats

    console.log('sets', JSON.stringify(stats.sets))


    /*
    ;['counters', 'counter_rates', 'gauges', 'sets'].forEach(type => {
      Object.keys(metrics[type]).forEach(name => {
        if (!stats[type][name])
          stats[type][name] = { x: [], y: [] }
        stats[type][name].x.push(timestamp)
        
        if (type === 'sets')
          Array.prototype.push.apply(stats[type][name].y, Object.keys(metrics[type][name].store).map(x => parseInt(x), 0))
        else
          stats[type][name].y.push(metrics[type][name])
      })
    })

    Object.keys(metrics.timers).forEach(name => {
      if (!stats.timers[name])
        stats.timers[name] = { hour: [], x: [], y: [], error_y: { array: [], arrayminus: [] } }
      const timer = stats.timers[name]

      if (timer.hour.length > 0 && timestamp - timer.hour[timer.hour.length - 1].x < 60 * 1000) 
        timer.hour[timer.hour.length - 1].y = timer.hour[timer.hour.length - 1].y.concat(metrics.timers[name])
      else {
        timer.hour.push({
          y: metrics.timers[name],
          x: timestamp,
          name: new Date(timestamp).toLocaleString(),
          type: 'box',
          boxmean: true 
        })
      }

      const mean = avg(metrics.timers[name])
      timer.x.push(timestamp)
      timer.y.push(mean)
      timer.error_y.array.push(max(metrics.timers[name]) - mean)
      timer.error_y.arrayminus.push(mean - min(metrics.timers[name]))
    })
    */
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
