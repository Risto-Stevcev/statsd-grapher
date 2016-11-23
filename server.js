const express = require('express')
    , session = require('express-session')
    , uuid    = require('uuid')
const R = require('ramda')
    , U = require('./src/utils')

const statusCodes = {
  unauthorized: 401,
  notFound: 404
}

// Set up express basics
const app = express()
app.use(express.static(`${__dirname}/public`))
app.set('views', `${__dirname}/views`)
app.set('view engine', 'jade')


// Exports `init` to implement the statsd backend
exports.init = function(startupTime, config, events) {
  // Calculates the number of flushes per hour and week for reseting stats
  const per = {
    hour: 60 * 60 * 24,
    week: 60 * 60 * 24 * 7
  }
  per.hour /= (config.flushInterval || 10000) / 1000
  per.week /= (config.flushInterval || 10000) / 1000

  // Keeps track of the flush count for reseting stats
  var flushCount = 0

  // The accumulated and formatted stats metrics
  var stats     = {}
    , statsKeys = {}


  // Session middleware
  app.use(session({
      secret: config.sessionSecret || uuid.v4(),
      store: config.sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: { expires: config.sessionExpires || 1000 * 60 * 60 }  // default: 1 hour
  }))

  // Authentication middleware using `tokens`
  app.use(function(req, res, next) {
    if (!req.session.authenticated && config.tokens && !R.contains(req.query.token, config.tokens))
      res.status(statusCodes.unauthorized).send('401: Unauthorized')
    else {
      req.session.authenticated = true
      next()
    }
  })

  // Updates the stats on flush intervals
  events.on('flush', function(timestamp, metrics) {
    timestamp *= 1000  // converts timestamp to unix time

    // Reset the stats if a week has passed
    if (flushCount === per.week) {
      stats = {}
      flushCount = 0
    } else {
      flushCount++
    }

    const newStats = U.setStats(timestamp, metrics, stats)
    stats = newStats
    statsKeys = R.map(R.keys, stats)
  })

  // Serve the routes
  app.get('/stats', function(req, res) {
    res.render('stats', statsKeys)
  })

  app.get('/stats/:namespace/:metric', function(req, res) {
    res.render('stats', U.filterStats(req.params.namespace, req.params.metric, statsKeys))
  })

  app.get('/metrics/:type/:name', function(req, res) {
    const metric = R.path([req.params.type, req.params.name], stats)

    if (!metric)
      res.status(statusCodes.notFound).send({ message: 'Not found' })
    else
      res.send(metric)
  })

  app.listen(config.expressPort || 3000, function () {
    console.log(`Express listening on port: ${config.expressPort || 3000}`)
  })

  return true
}
