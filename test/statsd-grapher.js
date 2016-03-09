const expect = require('chai').expect
const R = require('ramda')
    , S = require('sanctuary')
    , U = require('../src/utils')

const locale = (dateMsec) => new Date(dateMsec).toLocaleString()

describe('log', function() {
  it('should leave return the value unchanged', function() {
    expect(S.Maybe.of(4).map(U.log).map(a => a + 6).value).to.equal(10)
  })
})

describe('printLens', function() {
  it('should print the lens', function() {
    expect(U.printLens(R.lensPath(['a','b','c']))).to.equal('{"a":{"b":{"c":true}}}')
  })
})

describe('toInt', function() {
  it('should parseInt', function() {
    expect(U.toInt('23')).to.equal(23)
    expect(U.toInt('foo')).to.be.NaN
  })
})

describe('mLenses', function() {
  it('should get the lenses for the keys in the metric', function() {
    const metrics = { counters: { foo: 1, bar: 2} }
    U.mLenses('counters', metrics).forEach((lens, idx) => {
      expect(R.view(lens, metrics)).to.equal(idx + 1)
    })
  })
})

describe('initStats', function() {
  it('should initialize the the x and y values for the given metrics', function() {
    const metrics   = { counters: { foo: 1, bar: 2 } }
        , stats     = { gauges: { baz: { x: [123456], y: [3] } } }
        , mLenses   = U.mLenses('counters', metrics)
        , timestamp = Date.now()

    expect(U.initStats(mLenses, stats)).to.deep.equal({
      gauges:   { baz: { x: [123456], y: [3] } },
      counters: { foo: { x: [], y: [] }, bar: { x: [], y: [] } }
    })
  })
})

describe('setX', function() {
  it('should set the x value for the given timestamp', function() {
    const metrics    = { counters: { foo: 1, bar: 2 } }
        , stats      = { gauges: { baz: { x: [123456], y: [3] } } }
        , mLenses    = U.mLenses('counters', metrics)
        , timestamp  = Date.now()
        , timestamp2 = Date.now()

    expect(S.pipe([ U.initStats(mLenses)
                  , U.setX(timestamp,  mLenses)
                  , U.setX(timestamp2, mLenses) ], stats)).to.deep.equal({
      gauges:   { baz: { x: [123456], y: [3] } },
      counters: {
        foo: { x: [timestamp, timestamp2], y:[] },
        bar: { x: [timestamp, timestamp2], y:[] }
      }
    })
  })
})

describe('setY', function() {
  it('should set the y value for the given metrics', function() {
    const metrics   = { counters: { foo: 1, bar: 2 }, sets: { uniq: { store: {'4':'4','5':'5','6':'6'} } } }
        , stats     = { gauges: { baz: { x: [123456], y: [3] } } }
        , mLenses   = R.flatten(['counters', 'sets'].map(type => U.mLenses(type, metrics)))
        , timestamp = Date.now()

    expect(S.pipe([ U.initStats(mLenses)
                  , U.setY(metrics, mLenses) ], stats)).to.deep.equal({
      gauges:   { baz: { x: [123456], y: [3] } },
      counters: { foo:  { x:[], y: [1] }, bar: { x: [], y: [2] } },
      sets:     { uniq: { x: [], y: [4,5,6] } }
    })
  })

  //it('should concat in the right direction (metric idx should match its timestamp)')
})

describe('setXY', function() {
  it('should set the x and y values for the given timestamp and metrics', function() {
    const metrics    = { counters: { foo: 1, bar: 2 }, sets: { uniq: { store: {'4':'4','5':'5','6':'6'} } } }
        , metrics2   = { counters: { foo: 12, bar: 3 }, sets: { uniq: { store: {'7':'7','8':'8'} } } }
        , stats      = { gauges: { baz: { x: [123456], y: [3] } } }
        , timestamp  = Date.now()
        , timestamp2 = Date.now()

    expect(S.pipe([U.setXY(timestamp, metrics), U.setXY(timestamp2, metrics2)], stats)).to.deep.equal({
      gauges:   { baz: { x: [123456], y: [3] } },
      counters: { foo:  { x: [timestamp, timestamp2], y: [1,12] }
                , bar:  { x: [timestamp, timestamp2], y: [2,3]  } }
    })

  })
})

describe('setSets', function() {
  it('should set the x and y values for the given timestamp and metrics', function() {
    const metrics    = { counters: { foo: 1, bar: 2 }, sets: { uniq: { store: {'4':'4','5':'5','6':'6'} } } }
        , metrics2   = { counters: { foo: 12, bar: 3 }, sets: { uniq: { store: {'7':'7','8':'8'} } } }
        , stats      = { gauges: { baz: { x: [123456], y: [3] } } }
        , mLenses    = U.mLenses('sets', metrics)
        , timestamp  = Date.now()
        , timestamp2 = Date.now() + 10000

    expect(S.pipe([ U.initStats(mLenses)
                  , U.setSets(timestamp,  metrics)
                  , U.setSets(timestamp2, metrics2) ], stats)).to.deep.equal({
      gauges: { baz: { x: [123456], y: [3] } },
      sets: {
        uniq: {
          x: [timestamp,timestamp,timestamp,timestamp2,timestamp2],
          y: [4,5,6,7,8]
        }
      }
    })
  })
})



describe('initTimers', function() {
  it('should initialize the the x and y values for the given timer metrics', function() {
    const metrics   = { counters: { foo: 1, bar: 2 }, timers: { request: [300, 5, 23], response: [20, 235] } }
        , stats     = { gauges: { baz: { x: [123456], y: [3] } } }
        , mLenses    = U.mLenses('timers', metrics)

    expect(U.initTimers(mLenses, stats)).to.deep.equal({
      gauges: { baz: { x: [123456], y: [3] } },
      timers: { request:  { hour: [], x: [], y: [], error_y: { array: [], arrayminus: [] } }
              , response: { hour: [], x: [], y: [], error_y: { array: [], arrayminus: [] } } }
    })
  })
})

describe('setTimersHour', function() {
  it('should set the hour values to for given timestamp and timer metrics', function() {
    const metrics    = { counters: { foo: 1, bar: 2 }, timers: { request: [300, 5, 23], response: [20, 235] } }
        , metrics2   = { timers: { request: [450, 76], response: [83] } }
        , metrics3   = { timers: { request: [5, 3], response: [832, 2235, 502] } }
        , stats      = { gauges: { baz: { x: [123456], y: [3] } } }
        , mLenses    = U.mLenses('timers', metrics)
        , timestamp  = Date.now()
        , timestamp2 = timestamp + 58 * 1000
        , timestamp3 = timestamp + 60 * 1000


    expect(S.pipe([ U.initTimers(mLenses)
                  , U.setTimersHour(mLenses, timestamp,  metrics)
                  , U.setTimersHour(mLenses, timestamp2, metrics2)
                  , U.setTimersHour(mLenses, timestamp3, metrics3) ], stats)).to.deep.equal({
      gauges: { baz: { x: [123456], y: [3] } },
      timers: {
        request: {
          hour: [ { x: timestamp,  y: [450,76,300,5,23], name: locale(timestamp),  type: "box", boxmean: true }
                , { x: timestamp3, y: [5,3],             name: locale(timestamp3), type: "box", boxmean: true } ],
          x: [], y: [], error_y: { array: [], arrayminus: [] }
        },
        response: {
          hour: [ { x: timestamp,  y: [83,20,235],    name: locale(timestamp),  type: "box", boxmean: true }
                , { x: timestamp3, y: [832,2235,502], name: locale(timestamp3), type: "box", boxmean: true } ],
          x: [], y: [], error_y: { array: [], arrayminus: [] }
        }
      }
    })
  })
})

describe('setTimersXY', function() {
  it('should set the x and y values for the given timestamp and timer metrics', function() {
    const metrics   = { counters: { foo: 1, bar: 2 }, timers: { request: [300, 5, 23], response: [20, 235] } }
        , stats     = { gauges: { baz: { x: [123456], y: [3] } } }
        , mLenses   = U.mLenses('timers', metrics)
        , timestamp = Date.now()

    expect(S.pipe([U.initTimers(mLenses), U.setTimersXY(mLenses, timestamp, metrics)], stats)).to.deep.equal({
      gauges: { baz: { x: [123456], y: [3] } },
      timers: {
        request:  { hour: [], x: [timestamp], y: [109], error_y: { array: [191], arrayminus: [104] } },
        response: { hour: [], x: [timestamp], y: [128], error_y: { array: [107], arrayminus: [108] } }
      }
    })
  })
})

describe('setTimers', function() {
  it('should set the timer values for the given timestamp and timer metrics', function() {
    const metrics   = { counters: { foo: 1, bar: 2 }, timers: { request: [300, 5, 23], response: [20, 235] } }
        , stats     = { gauges: { baz: { x: [123456], y: [3] } } }
        , timestamp = Date.now()

    expect(U.setTimers(timestamp, metrics, stats)).to.deep.equal({
      gauges: { baz: { x: [123456], y: [3] } },
      timers: {
        request: {
          hour: [{ x: timestamp, y: [300,5,23], name: locale(timestamp), type: "box", boxmean: true }],
          x: [timestamp], y: [109], error_y: { array: [191], arrayminus: [104] }
        },
        response: {
          hour: [{ x: timestamp, y: [20,235], name: locale(timestamp), type: "box", boxmean: true }],
          x: [timestamp], y: [128], error_y: { array: [107], arrayminus: [108] }
        }
      }
    })
  })
})

describe('setStats', function() {
  it('should set the stats for the given timestamp and timer metrics', function() {
    const metrics   = { counters: { foo: 1, bar: 2 }
                      , timers: { request: [300, 5, 23], response: [20, 235] }
                      , gauges: { qux: 4, norf: 5 } 
                      , sets: { uniq: { store: {'4':'4','5':'5','6':'6'} } } }
        , stats     = { gauges: { baz: { x: [123456], y: [3] } } }
        , timestamp = Date.now()

    expect(U.setStats(timestamp, metrics, stats)).to.deep.equal({
      gauges:   { baz: { x: [123456], y: [3] }, qux: { x: [timestamp], y: [4] }, norf: { x: [timestamp], y: [5] } },
      counters: { foo: { x: [timestamp], y: [1] }, bar: { x: [timestamp], y: [2] } },
      timers: {
        request: {
          hour: [{ x: timestamp, y: [300,5,23], name: locale(timestamp), type: "box", boxmean: true }],
          x: [timestamp], y: [109], error_y: { array: [191], arrayminus: [104] }
        },
        response: {
          hour: [{ x: timestamp, y: [20,235], name: locale(timestamp), type: "box", boxmean: true }],
          x: [timestamp], y: [128], error_y: { array: [107], arrayminus: [108] }
        }
      },
      sets: { uniq: { x: [timestamp,timestamp,timestamp], y: [4,5,6] } }
    })
  })
})
