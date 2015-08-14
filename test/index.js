var path        = require('path');
var fs          = require('fs');
var QUnitServer = require('../lib/index.js');


var BASE_DIR      = __dirname;
var TESTS_DIR     = path.join(BASE_DIR, './tests');
var FIXTURES_PATH = path.join(TESTS_DIR, './fixtures');

var SCRIPT_PATH = path.join(TESTS_DIR, './resources/script.js');
var CSS_PATH    = path.join(TESTS_DIR, './resources/style.css');


function configApp (app) {
    app.post('/custom/:data', function (req, res) {
        res.send(req.params['data']);
    });
}

module.exports = new QUnitServer()
    .fixtures(FIXTURES_PATH)
    .port(2000)
    .crossDomainPort(2001)
    .scripts([{ src: '/script.js', path: SCRIPT_PATH }])
    .css([{ src: '/style.css', path: CSS_PATH }])
    .configApp(configApp)
    .create();
