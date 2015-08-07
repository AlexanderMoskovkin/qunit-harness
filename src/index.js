import express from 'express';
import http from 'http';
import path from 'path';
import mustache from 'mustache';
import hoganExpress from 'hogan-express';
import * as fs from './utils/fs';
import readDir from './utils/read-dir';
import pathToUrl from './utils/path-to-url';


const VIEWS_PATH            = path.join(__dirname, 'views');
const GLOBALS_TEMPLATE_PATH = path.join(__dirname, 'globals.mustache');


//Globals
var contentTypes = {
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.html': 'text/html',
    '':      'text/html'
};


//Routes
function onPingRequest (req, res) {
    var delay = req.params.delay || 0;

    setTimeout(() => res.send(delay), delay);
}

function preventCaching (req, res, next) {
    res.set('cache-control', 'no-cache, no-store, must-revalidate');
    next();
}

function onScriptRequest (req, res, content) {
    res.setHeader('content-type', contentTypes['.js']);
    res.send(content);
}


//QUnitServer
export default class QUnitServer {
    constructor () {
        this.port            = 1335;
        this.crossDomainPort = 1336;
        this.hostname        = 'http://localhost:' + this.port;
        this.fixturesPath    = '';
        this.markupPath      = '';
        this.dataPath        = '';
        this.currentDir      = '';

        this.app            = express();
        this.crossDomainApp = express();

        this.app.engine('mustache', hoganExpress);
        this.app.set('views', VIEWS_PATH);
        this.app.set('view engine', 'mustache');

        this.app.use(express.static(path.join(__dirname, '/vendor')));
        this.crossDomainApp.use(express.static(path.join(__dirname, '/vendor')));

        var globalsTemplate = fs.readfileSync(GLOBALS_TEMPLATE_PATH, 'utf-8');

        this.globalsSciprt = mustache.render(globalsTemplate, {
            hostname:            'http://localhost:' + this.port,
            crossDomainHostname: 'http://localhost:' + this.crossDomainPort
        });

        this.testResources = {
            scripts: [],
            css:     []
        };
    }

    _createServers () {
        http.createServer(this.app).listen(this.port);
        http.createServer(this.crossDomainApp).listen(this.crossDomainPort);
    }

    async _runTest (res, testPath) {
        var test = await fs.readfile(testPath);

        var markupPath  = testPath.replace(this.fixturesPath, this.markupPath).replace('.js', '.html');
        var markupStats = await fs.stat(markupPath);
        var markup      = markupStats ? await fs.readfile(markupPath) : '';

        res.locals = {
            test:    test,
            markup:  markup,
            globals: this.globalsSciprt,
            scripts: this.testResources.scripts,
            css:     this.testResources.css
        };
        res.render('test');
    }

    async _onResourceRequest (req, res, basePath) {
        var reqPath      = req.params[0] || '';
        var resourcePath = path.join(basePath, reqPath);

        var stats = await fs.stat(resourcePath);

        if (!stats)
            return res.send(404);

        if (stats.isDirectory()) {
            var { dirs, files } = await readDir(resourcePath);

            res.locals = {
                currentDir: req.path,
                dirs:       dirs,
                files:      files
            };

            return res.render('dir');
        }

        var ext = path.extname(resourcePath);

        if (ext === '.js' && resourcePath.indexOf(this.fixturesPath) > -1)
            return await this._runTest(res, resourcePath);

        res.set('Content-Type', contentTypes[ext]);
        res.send(await fs.readfile(resourcePath));
    }

    _setupRoutes () {
        //Prevent caching
        this.app.get('/*', preventCaching);
        this.crossDomainApp.get('/*', preventCaching);

        this.app.get('/', (req, res) => res.redirect('/fixtures'));

        this.app.get('/fixtures', (req, res) => this._onResourceRequest(req, res, this.fixturesPath));
        this.app.get('/fixtures/*', (req, res) => this._onResourceRequest(req, res, this.fixturesPath));
        this.app.get('/markup', (req, res) => this._onResourceRequest(req, res, this.markupPath));
        this.app.get('/markup/*', (req, res) => this._onResourceRequest(req, res, this.markupPath));
        this.app.get('/data', (req, res) => this._onResourceRequest(req, res, this.dataPath));
        this.app.get('/data/*', (req, res) => this._onResourceRequest(req, res, this.dataPath));

        this.crossDomainApp.get('/data', (req, res) => this._onResourceRequest(req, res, this.dataPath));
        this.crossDomainApp.get('/data/*', (req, res) => this._onResourceRequest(req, res, this.dataPath));

        this.app.all('/ping/:delay', onPingRequest);
        this.crossDomainApp.all('/ping/:delay', onPingRequest);
    }

    _registerScript (script) {
        this.testResources.scripts.push(script);

        this.app.get(script.src, (req, res) => onScriptRequest(req, res, script.content));
        this.crossDomainApp.get(script.src, (req, res) => onScriptRequest(req, res, script.content));
    }

    fixtures (fixturesPath) {
        this.fixturesPath = fixturesPath;
        return this;
    }

    markup (markupPath) {
        this.markupPath = markupPath;
        return this;
    }

    data (dataPath) {
        this.dataPath = dataPath;
        return this;
    }

    scripts (scripts) {
        if (Array.isArray(scripts))
            scripts.forEach(this._registerScript);
        else this._registerScript(scripts);

        return this;
    }

    configApp (config) {
        config(this.app);
        config(this.crossDomainApp);

        return this;
    }

    create () {
        if (!this.fixturesPath)
            throw 'fixtures path is not defined';

        this._createServers();
        this._setupRoutes();
        return this;
    }
};
