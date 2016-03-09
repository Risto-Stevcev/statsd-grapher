describe('graph view', function() {
  this.timeout(15000)

  it('should resize the browser window', function() {
    const windowSize = { width: 1200, height: 900 }
    return browser
      .windowHandleSize(windowSize)
      .getViewportSize('width').should.eventually.be.at.least(windowSize.width)
      .getViewportSize('height').should.eventually.be.at.least(windowSize.height - 100) // compensate for toolbars
  })

  it('should fail go to the site', function() {
   return browser.url('http://localhost:5000/stats')
     .getHTML('body', false).should.eventually.be.equal('401: Unauthorized')
  })

  it('should fail go to the site with an invalid token', function() {
   return browser.url('http://localhost:5000/stats?token=invalidtoken')
     .getHTML('body', false).should.eventually.be.equal('401: Unauthorized')
  })

  it('should go to the graph site', function() {
   return browser.url('http://localhost:5000/stats?token=foo')
     .getTitle().should.eventually.be.equal('statsd grapher')
     .waitForExist('.plotly svg', 5000)
  })

  it('should take the screenshot', function() {
    return browser
      .saveScreenshot(`${screenshotFolder}/graph.png`)
  })

  after(function() {
    return browser.end()
  })
})
