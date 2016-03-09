const gulp      = require('gulp')
    , glob      = require('glob')
    , mocha     = require('gulp-mocha')
    , istanbul  = require('gulp-istanbul')
    , coveralls = require('gulp-coveralls')
    , webdriver = require('gulp-webdriver')
    , selenium  = require('selenium-standalone')
    , spawn     = require('child_process').spawn
    , metrics   = require('./metrics')

var statsd_server

gulp.task('statsd', done => {
  statsd_server = spawn('./node_modules/.bin/statsd', [ 'exampleConfig.js' ])

  statsd_server.stderr.on('data', data => {
    console.error(data.toString())
  })

  statsd_server.stdout.on('data', data => {
    console.log(data.toString())
    if (/server is up/.test(data))
      done()
  })
})

gulp.task('selenium', done => {
  selenium.install({
    logger: message => { console.log(message) }
  }, err => {
    if (err) return done(err)

    selenium.start({
      seleniumArgs: ['-Dphantomjs.binary.path=./node_modules/.bin/phantomjs']
    }, (err, child) => {
      if (err) return done(err)
      selenium.child = child
      done()
    })
  })
})

gulp.task('metrics', ['statsd'], done => {
  metrics.send(done)
})


gulp.task('docs', done => {
  glob('src/utils.js', (err, files) => {
    const docco = spawn('node_modules/.bin/docco', ['--output', 'docs'].concat(files), { stdio: 'inherit' })
    docco.on('close', _ => done())
  })
})

gulp.task('coveralls', () => {
  return gulp.src('coverage/lcov.info')
    .pipe(coveralls())
})

gulp.task('istanbul', () => {
  return gulp.src('src/*.js')
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())  // Force `require` to return covered files 
})

gulp.task('test:unit', ['istanbul'], () => {
  return gulp.src('test/statsd-grapher.js')
    .pipe(mocha())
    .pipe(istanbul.writeReports())
    .pipe(istanbul.enforceThresholds({ thresholds: { global: 100 } }))
})

gulp.task('test:e2e', ['metrics', 'selenium'], () => {
  return gulp.src('wdio.conf.js')
    .pipe(webdriver())
    .once('end', () => {
      selenium.child.kill()
      statsd_server.kill()
    })
})


gulp.task('default', ['test:e2e'])
