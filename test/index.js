var path        = require('path');
var fs          = require('fs');
var QUnitServer = require('../lib/index.js');


var BASE_DIR      = __dirname;
var TESTS_DIR     = path.join(BASE_DIR, './tests');
var FIXTURES_PATH = path.join(TESTS_DIR, './fixtures');
var MARKUP_PATH   = path.join(TESTS_DIR, './markup');
var DATA_PATH     = path.join(TESTS_DIR, './data');

var ASSET_PATH = path.join(TESTS_DIR, './resources/script.js');


var script = fs.readFileSync(ASSET_PATH, 'utf-8');

var server = new QUnitServer()
    .fixtures(FIXTURES_PATH)
    .markup(MARKUP_PATH)
    .data(DATA_PATH)
    .scripts({ src: '/script.js', content: script })
    .create();

/*
var express = require('express');
var http    = require('http');

var app = express();
http.createServer(app).listen(3000);

app.get('/fixtures/!*', function (req, res) {
    res.end('/fixtures/!*');
});
*/
