# qunit-harness

A library for running qunit tests on a local machine and in the [SauceLabs](https://saucelabs.com) environment.

[![Build Status](https://travis-ci.org/AlexanderMoskovkin/qunit-harness.svg)](https://travis-ci.org/AlexanderMoskovkin/qunit-harness)

##Install

`$ npm install qunit-harness`

##Usage
```js
var QUnitHarness = require('qunit-harness');

function configQunitServerApp (app) {
    app.post('/my-custom-request', function (req, res) {
        res.end('ok');
    });
}

//Local machine testing
var qunitHarness = new QUnitHarness
    //set path with tests
    .fixtures('/tests/')
    //set qunit server ports
    .port(2000)             //by default 1335
    .crossDomainPort(2001)  //by default 1336
    //add index.js script content as a <script src='/tested-script.js'> in the head of the test page
    .scripts([{ src: '/tested-script.js', path: '/lib/index.js' }]) 
    .css([{ src: '/style.css', path: '/lib/style.css' }])
    //extend qunit server application for test purposes
    .configApp(configQunitServerApp)
    .create();
    
//Testing in the Saucelabs environment
//Configure browsers here: https://docs.saucelabs.com/reference/platforms-configurator/
var BROWSERS = [
    {
        platform:    'Windows 10',
        browserName: 'chrome'
    },
    {
        platform:    'Windows 10',
        browserName: 'firefox'
    },
    {
        platform:    'Windows 10',
        browserName: 'internet explorer',
        version:     '11.0'
    }
];

var SAUCELABS_SETTINGS = {
    username:  <saucelabs_username>,
    accessKey: <saucelabs_accessKey>,
    build:     'build',
    tags:      ['master'],
    browsers:  BROWSERS,
    name:      'qunit tests',
    timeout:   180  //sec
};

qunitHarness
    .saucelabs(SAUCELABS_SETTINGS)
    .tests(['/tests/test1-test.js', '/tests/test2-test.js'])
    .run()
    .then(function () {
        console.log('Tests done');
    })
    .catch(function (err) {
        console.log(err);
    });
```

##QUnit tests
####Get test server hostname
```js
window.QUnitGlobals.hostname;               //http://localhost:1335/
window.QUnitGlobals.crossDomainHostname;   //http://localhost:1336/
```

####Get test resource
```html
<!-- data/iframe.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Iframe page</title>
    <meta charset="utf-8">
</head>
<body>
    Some content
</body>
</html>
```

```js
// tests/test1-test.js
asyncTest('iframe test', function () {
    var iframeSrc = window.QUnitGlobals.getResourceUrl('../data/iframe.html', 'iframe.html');
    $('<iframe></iframe>').src(iframeSrc).appendTo('body');
    //appends an iframe with url http://<hostname>/test-resource/iframe.html
    ...
});
```

#### Run a test with some markup on the page
```html
<!-- tests/markup-test/index.html -->
<div id="#test-element"></div>
```

```js
// tests/markup-test/index-test.js
test('check element', function () {
    ok($('#test-element').length);  //success
});
```
