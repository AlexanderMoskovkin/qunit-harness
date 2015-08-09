import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';
import path from 'path';
import mustache from 'mustache';
import hoganExpress from 'hogan-express';
import * as fs from './utils/fs';
import readDir from './utils/read-dir';
import getTests from './utils/get-tests';
import pathToUrl from './utils/path-to-url';

import * as saucelabs from './saucelabs/saucelabs';
import reportSauceLabsTests from './saucelabs/report';


const VIEWS_PATH                = path.join(__dirname, 'views');
const GLOBALS_TEMPLATE_PATH     = path.join(__dirname, 'templates/globals.mustache');
const QUNIT_SETUP_TEMPLATE_PATH = path.join(__dirname, 'templates/qunit-setup.mustache');


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

        this.appServer            = null;
        this.crossDomainAppServer = null;

        this.app.engine('mustache', hoganExpress);
        this.app.set('views', VIEWS_PATH);
        this.app.set('view engine', 'mustache');

        this.app.use(express.static(path.join(__dirname, '/vendor')));
        this.crossDomainApp.use(express.static(path.join(__dirname, '/vendor')));
        this.app.use(bodyParser.json());

        this.globalsTemplate    = fs.readfileSync(GLOBALS_TEMPLATE_PATH, 'utf-8');
        this.qunitSetupTemplate = fs.readfileSync(QUNIT_SETUP_TEMPLATE_PATH, 'utf-8');

        this.hostname            = 'http://localhost:' + this.port;
        this.crossDomainHostname = 'http://localhost:' + this.crossDomainPort;

        this.testResources = {
            scripts: [],
            css:     []
        };

        this.tasks        = {};
        this.tasksCounter = 0;

        this.sauselabsSettings = null;
        this.sauselabsTunnel   = null;
    }

    _createServers () {
        this.appServer            = http.createServer(this.app).listen(this.port);
        this.crossDomainAppServer = http.createServer(this.crossDomainApp).listen(this.crossDomainPort);
    }

    async _runTest (res, testPath, taskId) {
        var test = await fs.readfile(testPath);

        var markupPath  = testPath.replace(this.fixturesPath, this.markupPath).replace('.js', '.html');
        var markupStats = await fs.stat(markupPath);
        var markup      = markupStats ? await fs.readfile(markupPath) : '';

        var hostname            = this.hostname;
        var crossDomainHostname = this.crossDomainHostname;
        var relativeTestPath    = path.relative(this.fixturesPath, testPath);
        var globals             = mustache.render(this.globalsTemplate, {
            crossDomainHostname: crossDomainHostname,
            path:                pathToUrl(relativeTestPath),
            taskId:              taskId,
            hostname:            hostname
        });

        res.locals = {
            test:       test,
            taskId:     taskId || '',
            markup:     markup,
            globals:    globals,
            qunitSetup: mustache.render(this.qunitSetupTemplate, { taskId }),
            scripts:    this.testResources.scripts,
            css:        this.testResources.css
        };
        res.render('test');
    }

    async _runDir (res, dir) {
        var relativeDir = path.relative('/fixtures', '/' + dir + '/');
        var testsPath   = path.join(this.fixturesPath, relativeDir);
        var tests       = await getTests(testsPath, path.join(this.fixturesPath));

        if (!tests.length)
            return res.redirect(302, this.fixturesPath + dir);

        var task = {
            id:        ++this.tasksCounter,
            path:      path.join('/fixtures', relativeDir),
            tests:     tests,
            total:     tests.length,
            completed: 0,
            reports:   []
        };

        this.tasks[task.id] = task;

        await this._runTest(res, path.join(this.fixturesPath, tests[0]), task.id);
    }

    _onTestDone (res, report, taskId) {
        var task = this.tasks[taskId];

        if (task.completed === task.total)
            return res.end();

        task.completed++;
        task.reports.push({
            name:   pathToUrl(path.join('/fixtures', task.tests[0])),
            result: report
        });

        task.tests.shift();

        res.end(task.tests.length ? '/fixtures/' + pathToUrl(task.tests[0]) : '/report');
    }

    _onReportRequest (res, taskId) {
        var task              = this.tasks[taskId];
        var failedTaskReports = task.reports.filter(report => report.result.failed);

        res.locals = {
            taskPath:          task.path,
            encodedTaskPath:   encodeURIComponent(task.path),
            total:             task.total,
            completed:         task.completed,
            passed:            task.completed - failedTaskReports.length,
            failed:            failedTaskReports.length,
            failedTaskReports: failedTaskReports
        };

        res.render('report');
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
                currentDir:        req.path,
                encodedCurrentDir: encodeURIComponent(req.path),
                dirs:              dirs,
                files:             files
            };

            return res.render('dir');
        }

        var ext = path.extname(resourcePath);

        if (ext === '.js' && resourcePath.indexOf(this.fixturesPath) > -1)
            return await this._runTest(res, resourcePath, req.query['taskId']);

        res.set('Content-Type', contentTypes[ext]);
        res.send(await fs.readfile(resourcePath));
    }

    _setupRoutes () {
        //Prevent caching
        this.app.get('/*', preventCaching);
        this.crossDomainApp.get('/*', preventCaching);

        this.app.get('/', (req, res) => res.redirect('/fixtures'));

        this.app.get('/run-dir/:dir', (req, res) => this._runDir(res, decodeURIComponent(req.params['dir'])));
        this.app.get('/report', (req, res) => this._onReportRequest(res, req.query['taskId']));
        this.app.post('/test-done/:id', (req, res) => this._onTestDone(res, req.body.report, req.params['id']));

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

    saucelabs (settings) {
        var curSettings = this.sauselabsSettings || {};

        this.sauselabsSettings = {
            username:  settings.username || curSettings.username || '',
            accessKey: settings.accessKey || curSettings.accessKey || '',
            build:     settings.build || curSettings.build || 'build',
            tags:      settings.tags || curSettings.tags || 'master',
            browsers:  settings.browsers || curSettings.browsers || {},
            name:      settings.name || curSettings.name || 'QUnit tests',
            urls:      [this.hostname + '/run-dir/fixtures'],
            timeout:   settings.timeout || curSettings.timeout || 30
        };

        return this;
    }

    close () {
        this.appServer.close();
        this.crossDomainAppServer.close();
    }

    async run () {
        if (!this.sauselabsSettings)
            return;

        var report = null;
        var error  = null;

        var tunnel = await saucelabs.openTunnel(this.sauselabsSettings);

        try {
            report = await saucelabs.run(this.sauselabsSettings);
        }
        catch (err) {
            error = err;
        }
        finally {
            await saucelabs.closeTunnel(tunnel);
        }

        if (error)
            throw error;

        if (!reportSauceLabsTests(report))
            throw 'tests failed';
    }
};
