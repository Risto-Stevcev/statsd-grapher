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
          hour: [ { x: timestamp,  y: [450,76,300,5,23], name: locale(timestamp),  type: 'box', boxmean: true }
                , { x: timestamp3, y: [5,3],             name: locale(timestamp3), type: 'box', boxmean: true } ],
          x: [], y: [], error_y: { array: [], arrayminus: [] }
        },
        response: {
          hour: [ { x: timestamp,  y: [83,20,235],    name: locale(timestamp),  type: 'box', boxmean: true }
                , { x: timestamp3, y: [832,2235,502], name: locale(timestamp3), type: 'box', boxmean: true } ],
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
          hour: [{ x: timestamp, y: [300,5,23], name: locale(timestamp), type: 'box', boxmean: true }],
          x: [timestamp], y: [109], error_y: { array: [191], arrayminus: [104] }
        },
        response: {
          hour: [{ x: timestamp, y: [20,235], name: locale(timestamp), type: 'box', boxmean: true }],
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
          hour: [{ x: timestamp, y: [300,5,23], name: locale(timestamp), type: 'box', boxmean: true }],
          x: [timestamp], y: [109], error_y: { array: [191], arrayminus: [104] }
        },
        response: {
          hour: [{ x: timestamp, y: [20,235], name: locale(timestamp), type: 'box', boxmean: true }],
          x: [timestamp], y: [128], error_y: { array: [107], arrayminus: [108] }
        }
      },
      sets: { uniq: { x: [timestamp,timestamp,timestamp], y: [4,5,6] } }
    })
  })
})

describe('testNs', function() {
  it('should test a string to see if it begins with the namespace', function() {
    expect(U.testNs('http.get', 'http.get')).to.be.true
    expect(U.testNs('http.get', 'http.get.foo')).to.be.true
    expect(U.testNs('http.put', 'http.get.foo')).to.be.false
    expect(U.testNs('http.get', 'http.put.foo')).to.be.false
  })
})

describe('pickNs', function() {
  it('should pick key/value pairs that only match the given namespace', function() {
    const counters = { 'http.get.foo': 1, 'http.get.bar': 1, 'http.get.bar.qux': 0, 'http.put.foo': 1 }
    expect(U.pickNs('ftp', counters)).to.be.empty
    expect(U.pickNs('http', counters)).to.deep.equal(counters)
    expect(U.pickNs('http.put', counters)).to.deep.equal({ 'http.put.foo': 1 })
    expect(U.pickNs('http.get.bar', counters)).to.deep.equal({ 'http.get.bar': 1, 'http.get.bar.qux': 0 })
    expect(U.pickNs('http.get', counters)).to.deep.equal({ 'http.get.foo': 1, 'http.get.bar': 1, 'http.get.bar.qux': 0 })
  })

  it('should properly match periods as actual periods and not RegEx . (any char)', function() {
    expect(U.pickNs('http.put', { 'http-put-foo': 1 })).to.be.empty
  })
})

describe('filterStats', function() {
  describe('stats keys', function() {
    before(function() {
      this.stats = {
        counters: ['http.get.foo', 'http.get.bar', 'http.get.bar.qux', 'http.put.foo'],
        counter_rates: ['http.post.norf'],
        timers: ['http.put.baz', 'http.put.qux'],
        gauges: ['http.get.bar']
      }
    })

    it('should filter for a specific metric', function() {
      expect(U.filterStats('ftp', 'counters', this.stats)).to.be.empty
      expect(U.filterStats('http', 'counters', this.stats)).to.deep.equal(this.stats.counters)
      expect(U.filterStats('http.get', 'counters', this.stats)).to.deep.equal(['http.get.foo', 'http.get.bar', 'http.get.bar.qux'])
      expect(U.filterStats('http.get.bar', 'counters', this.stats)).to.deep.equal(['http.get.bar', 'http.get.bar.qux'])
    })

    it('should filter all metrics if "all" is passed', function() {
      expect(U.filterStats('http.get', 'all', this.stats)).to.deep.equal({
        counter_rates: [],
        counters: ['http.get.foo', 'http.get.bar', 'http.get.bar.qux'],
        gauges: ['http.get.bar'],
        timers: []
      })

      expect(U.filterStats('http.get.bar', 'all', this.stats)).to.deep.equal({
        counter_rates: [],
        counters: ['http.get.bar', 'http.get.bar.qux'],
        gauges: ['http.get.bar'],
        timers: []
      })

      expect(U.filterStats('http.put', 'all', this.stats)).to.deep.equal({
        counter_rates: [],
        counters: ['http.put.foo'],
        gauges: [],
        timers: ['http.put.baz', 'http.put.qux']
      })

      expect(U.filterStats('http.post', 'all', this.stats)).to.deep.equal({
        counter_rates: ['http.post.norf'],
        counters: [],
        gauges: [],
        timers: []
      })

      expect(U.filterStats('http', 'all', this.stats)).to.deep.equal(this.stats)

      expect(U.filterStats('ftp', 'all', this.stats)).to.deep.equal({
        counter_rates: [],
        counters: [],
        gauges: [],
        timers: []
      })

      expect(U.filterStats('', '', this.stats)).to.be.empty
      expect(U.filterStats('blah', '', this.stats)).to.be.empty
      expect(U.filterStats('', 'blah', this.stats)).to.be.empty
    })
  })

  describe('full stats', function() {
    before(function() {
      this.stats = {
        counters: { 'http.get.foo': 1, 'http.get.bar': 1, 'http.get.bar.qux': 0, 'http.put.foo': 1 },
        counter_rates: { 'http.post.norf': 1.2 },
        timers: { 'http.put.baz': [123], 'http.put.qux': [345] },
        gauges: { 'http.get.bar': 200 }
      }
    })

    it('should filter for a specific metric', function() {
      expect(U.filterStats('ftp', 'counters', this.stats)).to.be.empty
      expect(U.filterStats('http', 'counters', this.stats)).to.deep.equal(this.stats.counters)
      expect(U.filterStats('http.get', 'counters', this.stats)).to.deep.equal({ 'http.get.foo': 1, 'http.get.bar': 1, 'http.get.bar.qux': 0 })
      expect(U.filterStats('http.get.bar', 'counters', this.stats)).to.deep.equal({ 'http.get.bar': 1, 'http.get.bar.qux': 0 })
    })

    it('should filter all metrics if "all" is passed', function() {
      expect(U.filterStats('http.get', 'all', this.stats)).to.deep.equal({
        counter_rates: {},
        counters: { 'http.get.foo': 1, 'http.get.bar': 1, 'http.get.bar.qux': 0 },
        gauges: { 'http.get.bar': 200 },
        timers: {}
      })

      expect(U.filterStats('http.get.bar', 'all', this.stats)).to.deep.equal({
        counter_rates: {},
        counters: { 'http.get.bar': 1, 'http.get.bar.qux': 0 },
        gauges: { 'http.get.bar': 200 },
        timers: {}
      })

      expect(U.filterStats('http.put', 'all', this.stats)).to.deep.equal({
        counter_rates: {},
        counters: { 'http.put.foo': 1 },
        gauges: {},
        timers: { 'http.put.baz': [123], 'http.put.qux': [345] }
      })

      expect(U.filterStats('http.post', 'all', this.stats)).to.deep.equal({
        counter_rates: { 'http.post.norf': 1.2 },
        counters: {},
        gauges: {},
        timers: {}
      })

      expect(U.filterStats('http', 'all', this.stats)).to.deep.equal(this.stats)

      expect(U.filterStats('ftp', 'all', this.stats)).to.deep.equal({
        counter_rates: {},
        counters: {},
        gauges: {},
        timers: {}
      })

      expect(U.filterStats('', '', this.stats)).to.be.empty
      expect(U.filterStats('blah', '', this.stats)).to.be.empty
      expect(U.filterStats('', 'blah', this.stats)).to.be.empty
    })
  })
})
