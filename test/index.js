var path        = require('path');
var fs          = require('fs');
var QUnitServer = require('../lib/index.js');


var BASE_DIR      = __dirname;
var TESTS_DIR     = path.join(BASE_DIR, './tests');
var FIXTURES_PATH = path.join(TESTS_DIR, './fixtures');

var SCRIPT_PATH = path.join(TESTS_DIR, './resources/script.js');
var CSS_PATH    = path.join(TESTS_DIR, './resources/style.css');


var script = fs.readFileSync(SCRIPT_PATH, 'utf-8');
var css    = fs.readFileSync(CSS_PATH, 'utf-8');

function configApp (app) {
    app.post('/custom/:data', function (req, res) {
        res.send(req.params['data']);
    });
}

module.exports = new QUnitServer()
    .fixtures(FIXTURES_PATH)
    .scripts({ src: '/script.js', content: script })
    .css({ src: '/style.css', content: css })
    .configApp(configApp)
    .create();
