const R = require('ramda')
    , S = require('sanctuary')

// `log :: a -> a`  
// Uses `R.tap` to print to console
const log = R.tap(x => console.log('log: ', x))

// `printLens :: Lens s a -> String`  
// Prints `lensPath`/`lensProp` lenses
const printLens = lens => JSON.stringify(R.set(lens, true, {}))

// `toInt :: String -> Int`
const toInt = R.curryN(1, parseInt)

// `mLenses :: String -> Object -> [Lens s a]`  
// Takes a metric type and the metrics, and returns lenss to all the keys in that metric
const mLenses = R.curry((type, metrics) => S.pipe([R.prop(type), R.keys, R.map(R.pipe(R.pair(type), R.lensPath))], metrics))

// `_initStats :: Object -> [Lens s a] -> Object -> Object`
const _initStats = R.curry((object, mLenses, stats) =>
  R.reduce((stats, mLens) =>
    R.when(R.pipe(R.view(mLens), R.isNil), R.set(mLens, object))(stats), stats, mLenses))

// `:: [Lens s a] -> Object -> Object` 
const initStats  = _initStats({ x: [], y: [] })
    , initTimers = _initStats({ hour: [], x: [], y: [], error_y: { array: [], arrayminus: [] } })

// `:: Lens s a => Lens s a`
const x      = lens => R.compose(lens, R.lensProp('x'))
    , y      = lens => R.compose(lens, R.lensProp('y'))
    , hour   = lens => R.compose(lens, R.lensProp('hour'))
    , store  = lens => R.compose(lens, R.lensProp('store'))
    , aplus  = lens => R.compose(lens, R.lensPath(['error_y', 'array']))
    , aminus = lens => R.compose(lens, R.lensPath(['error_y', 'arrayminus']))


// `setX :: Int -> Object -> [Lens s a] -> Object`
const setX = R.curry((timestamp, mLenses, stats) =>
  R.reduce((stats, mLens) => 
    R.over(x(mLens), R.append(timestamp), stats), stats, mLenses))

// `setY :: String -> Object -> [Lens s a] -> Object`
const setY = R.curry((metrics, mLenses, stats) =>
  R.reduce((stats, mLens) => { 
    return S.pipe([R.view(store(mLens)), R.isNil, R.not], metrics) ?
           R.over(y(mLens), R.concat(R.__, S.pipe([R.keys, R.map(toInt)], R.view(store(mLens), metrics))), stats) :
           R.over(y(mLens), R.append(R.view(mLens, metrics)), stats)
  }, stats, mLenses))

// `setXY :: Object -> Int -> Object`
const setXY = R.curry((timestamp, metrics, stats) => {
  const lenses = R.flatten(['counters', 'counter_rates', 'gauges'].map(type => mLenses(type, metrics)))
  return S.pipe([initStats(lenses), setX(timestamp, lenses), setY(metrics, lenses)], stats)
})


// `setSets :: String -> Object -> Object -> Object`
const setSets = R.curry((timestamp, metrics, stats) => {
  const lenses = mLenses('sets', metrics)
  return R.reduce((stats, mLens) => {
    const setCount = R.keys(R.view(store(mLens), metrics)).length
    return S.pipe([ R.over(x(mLens), R.concat(R.__, R.repeat(timestamp, setCount)))
                  , R.over(y(mLens), R.concat(R.__, S.pipe([R.keys, R.map(toInt)], R.view(store(mLens), metrics))))
                  ], stats)
  }, initStats(lenses, stats), lenses)
})


// `setTimersHour :: [Lenses s a] -> String -> Object -> Object -> Object`
const setTimersHour = R.curry((mLenses, timestamp, metrics, stats) =>
  R.reduce((stats, mLens) => {
    const timerHour = R.view(hour(mLens), stats)
        , lastY     = R.compose(hour(mLens), R.lensIndex(timerHour.length - 1), R.lensProp('y'))

    if (R.not(R.isEmpty(timerHour)) && timestamp - R.last(timerHour).x < 60 * 1000)
      return R.over(lastY, R.concat(R.view(mLens, metrics)), stats)
    else
      return R.over(hour(mLens), R.append({
        x: timestamp,
        y: R.view(mLens, metrics),
        name: new Date(timestamp).toLocaleString(),
        type: 'box',
        boxmean: true
      }), stats)
  }, stats, mLenses))

// `setTimersXY :: [Lenses s a] -> String -> Object -> Object -> Object`
const setTimersXY = R.curry((mLenses, timestamp, metrics, stats) =>
  R.reduce((stats, mLens) => {
    const mean  = Math.round(R.mean(R.view(mLens, metrics)))
        , plus  = R.reduce(R.max, 0, R.view(mLens, metrics)) - mean
        , minus = mean - R.reduce(R.min, Infinity, R.view(mLens, metrics))
    
    return S.pipe([ R.over(x(mLens),      R.append(timestamp))
                  , R.over(y(mLens),      R.append(mean))
                  , R.over(aplus(mLens),  R.append(plus))
                  , R.over(aminus(mLens), R.append(minus))], stats)
  }, stats, mLenses))

// `setTimers :: Object -> Object -> Object -> Object`
const setTimers = R.curry((timestamp, metrics, stats) => {
  const lenses = mLenses('timers', metrics)
  return S.pipe([ initTimers(lenses)
                , setTimersHour(lenses, timestamp, metrics)
                , setTimersXY(lenses, timestamp, metrics)
                ], stats)
})


// `setStats :: Object -> Object -> Object -> Object`
const setStats = R.curry((timestamp, metrics, stats) =>
  S.pipe([ setXY(timestamp, metrics)
         , setSets(timestamp, metrics)
         , setTimers(timestamp, metrics) ], stats))


module.exports = {
  setTimersHour: setTimersHour,
  setTimersXY:   setTimersXY,

  initTimers: initTimers,
  initStats:  initStats,

  setTimers:  setTimers,
  setStats:   setStats,
  setSets:    setSets,
  setXY:      setXY,
  setX:       setX,
  setY:       setY,

  mLenses:    mLenses,

  printLens:  printLens,
  toInt:      toInt,
  log:        log
}
