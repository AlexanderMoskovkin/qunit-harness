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
    //specify the path to the tests
    .fixtures('/tests/')
    //specify qunit server ports
    .port(2000)             //by default 1335
    .crossDomainPort(2001)  //by default 1336
    //add the index.js script content as <script src='/tested-script.js'> to the head of the test page
    .scripts([{ src: '/tested-script.js', path: '/lib/index.js' }])
    .css([{ src: '/style.css', path: '/lib/style.css' }])
    //extend the qunit server application for test purposes
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
####Wait for an async action
```js
window.QUnitGlobals.wait(condition);    // returns Promise
// condition is a function
// The test will fail with the timeout error if condition returns 'false' within 3000 ms.
```

Example:
```js
asyncTest('test with wait', function () {
    var resolved = false;

    window.setTimeout(function () {
        resolved = true;
    }, 50);

    window.QUnitGlobals.wait(function () {
            return resolved;
        })
        .then(function () {
            ok(true);
            start();
        });
});
```

####Wait for an iframe action
```js
window.QUnitGlobals.waitForIframe(iframe);    // returns Promise
// iframe is an iframe element to wait for
// The test will fail with the timeout error if the 'load' event for the iframe is not raised within 10000 ms.
```

Example:
```js
asyncTest('test with wait for iframe', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.QUnitGlobals.getResourceUrl('../data/iframe.html');

    document.body.appendChild(iframe);

    window.QUnitGlobals.waitForIframe(iframe).then(function () {
        ok(true);
        start();
    });
});
```

####Get test server hostname
```js
window.QUnitGlobals.hostname;               //http://localhost:1335/
window.QUnitGlobals.crossDomainHostname;   //http://localhost:1336/
```

####Get test resource
```js
window.QUnitGlobals.getResourceUrl(pathToResourceFile[, urlAlias])
```
By default the resource has the `http://<hostname>/test-resource?filePath=<resourceFilePath>&base=<currentTestFilePath>` url.
To customize the url, use the `urlAlias` argument:
```js
window.QUnitGlobals.getResourceUrl('../data/script.js', 'my-custom-script/script.js');
//returns "http://<hostname>/test-resource/my-custom-script/script.js?filePath=..."
```

**Example:**
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
    //appends an iframe with the url http://<hostname>/test-resource/iframe.html
    ...
});
```
#### Run a test with some markup on the page
Put the `testname-test.js` and `testname.html` files to the folder with the `-test` postfix. Then, the markup from the `.html` file will be included into the `testname-test.js` test page.

**Example:**
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
