import bodyParser from 'body-parser';
import express from 'express';
import http from 'http';
import path from 'path';
import mustache from 'mustache';
import hoganExpress from 'hogan-express';
import os from 'os';
import * as fs from './utils/fs';
import readDir from './utils/read-dir';
import getTests from './utils/get-tests';
import pathToUrl from './utils/path-to-url';

import * as saucelabs from './saucelabs/saucelabs';
import reportSauceLabsTests from './saucelabs/report';


const VIEWS_PATH                    = path.join(__dirname, 'views');
const GLOBALS_TEMPLATE_PATH         = path.join(__dirname, 'templates/globals.mustache.js');
const QUNIT_SETUP_TEMPLATE_PATH     = path.join(__dirname, 'templates/qunit-setup.mustache');
const STORE_GLOBALS_TEMPLATE_PATH   = path.join(__dirname, 'templates/store-globals.mustache');
const RESTORE_GLOBALS_TEMPLATE_PATH = path.join(__dirname, 'templates/restore-globals.mustache');


//Globals
var contentTypes = {
    '.js':     'application/javascript',
    '.css':    'text/css',
    '.html':   'text/html',
    'default': 'text/html'
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

async function onScriptRequest (req, res, filePath) {
    var content = await fs.readfile(filePath);

    res.setHeader('content-type', contentTypes['.js']);
    res.send(content);
}

async function onCssRequest (req, res, filePath) {
    var content = await fs.readfile(filePath);

    res.setHeader('content-type', contentTypes['.css']);
    res.send(content);
}

async function getFile (res, filePath) {
    res.set('Content-Type', contentTypes[path.extname(filePath)]);
    res.send(await fs.readfile(filePath));
}

//QUnitServer
export default class QUnitServer {
    constructor () {
        this.serverPort            = 1335;
        this.crossDomainServerPort = 1336;
        this.hostname              = '';
        this.crossDomainHostname   = '';

        this.basePath = '';

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

        this.globalsTemplate        = fs.readfileSync(GLOBALS_TEMPLATE_PATH, 'utf-8');
        this.qunitSetupTemplate     = fs.readfileSync(QUNIT_SETUP_TEMPLATE_PATH, 'utf-8');
        this.storeGlobalsTemplate   = fs.readfileSync(STORE_GLOBALS_TEMPLATE_PATH, 'utf-8');
        this.restoreGlobalsTemplate = fs.readfileSync(RESTORE_GLOBALS_TEMPLATE_PATH, 'utf-8');

        this.testResources = {
            scripts: [],
            css:     []
        };

        this.tasks        = {};
        this.tasksCounter = 0;
        this.pendingTests = [];

        this.sauselabsSettings = null;
        this.sauselabsTunnel   = null;
    }


    //Init
    _createServers () {
        this.localhostname = 'http://localhost:' + this.serverPort;

        var hostname = process.env.TRAVIS ? `http://${os.hostname()}:` : 'http://localhost:';

        this.hostname            = hostname + this.serverPort;
        this.crossDomainHostname = hostname + this.crossDomainServerPort;

        this.appServer            = http.createServer(this.app).listen(this.serverPort);
        this.crossDomainAppServer = http.createServer(this.crossDomainApp).listen(this.crossDomainServerPort);
    }

    _setupRoutes () {
        //Prevent caching
        this.app.get('/*', preventCaching);
        this.crossDomainApp.get('/*', preventCaching);

        this.app.get('/', (req, res) => res.redirect('/fixtures'));
        this.app.get('/start', (req, res) => {
            return res.redirect(302, this.hostname + '/run-tests');
        });
        this.app.get('/run-tests', (req, res) => this._runTests(res, this.pendingTests.map(item => item)));
        this.app.get('/run-dir/:dir', (req, res) => this._runDir(res, decodeURIComponent(req.params['dir'])));
        this.app.post('/test-done/:id', (req, res) => this._onTestDone(res, req.body.report, req.params['id']));
        this.app.get('/report/:id', (req, res) => this._onReportRequest(res, req.params['id']));

        this.app.get('/test-resource(/)?*', (req, res) => {
            getFile(res, path.join(path.dirname(req.query['base']), req.query['filePath']))
        });
        this.crossDomainApp.get('/test-resource(/:name)?', (req, res) => {
            getFile(res, path.join(path.dirname(req.query['base']), req.query['filePath']));
        });

        this.app.get('/fixtures', (req, res) => this._onResourceRequest(req, res, this.basePath));
        this.app.get('/fixtures/*', (req, res) => this._onResourceRequest(req, res, this.basePath));

        this.app.all('/ping/:delay', onPingRequest);
        this.crossDomainApp.all('/ping/:delay', onPingRequest);
    }

    _registerScript (script) {
        this.testResources.scripts.push(script);

        this.app.get(script.src, (req, res) => onScriptRequest(req, res, script.path));
        this.crossDomainApp.get(script.src, (req, res) => onScriptRequest(req, res, script.path));
    }

    _registerCss (css) {
        this.testResources.css.push(css);

        this.app.get(css.src, (req, res) => onCssRequest(req, res, css.path));
        this.crossDomainApp.get(css.src, (req, res) => onCssRequest(req, res, css.path));
    }


    //Request handlers
    async _onResourceRequest (req, res, basePath) {
        var reqPath      = req.params[0] || '';
        var resourcePath = path.join(basePath, reqPath);

        var stats = await fs.stat(resourcePath);

        if (!stats)
            return res.sendStatus(404);

        if (stats.isDirectory()) {
            var { dirs, files } = await readDir(resourcePath);

            dirs = dirs.map(dir => {
                return { path: dir };
            });

            files = files.map(file => {
                return { path: file };
            });

            res.locals = {
                currentDir:        req.path.replace(/^\//, ''),
                encodedCurrentDir: encodeURIComponent(req.path.replace(/^\//, '')),
                dirs:              dirs,
                files:             files
            };

            return res.render('dir');
        }

        if (resourcePath.indexOf('-test.js') > -1)
            return await this._runTest(res, resourcePath, req.query['taskId']);

        return await getFile(res, resourcePath);
    }

    _onTestDone (res, report, taskId) {
        var task = this.tasks[taskId];

        if (task.completed === task.total)
            return res.end();

        task.completed++;
        task.reports.push({
            name:   pathToUrl(path.join('/fixtures', path.relative(this.basePath, task.tests[0]))),
            result: report
        });

        task.tests.shift();

        var redirectUrl = task.tests.length ?
                          pathToUrl('/fixtures/' + path.relative(this.basePath, task.tests[0]) + '?taskId=' + taskId) :
                          '/report/' + taskId;


        res.set('Content-Type', contentTypes['default']);
        res.end(redirectUrl);
    }

    _onReportRequest (res, taskId) {
        var task              = this.tasks[taskId];
        var failedTaskReports = task.reports.filter(report => report.result.failed);
        var reports           = task.reports;
        var taskPath          = pathToUrl(task.path).replace(/^\//, '');

        res.locals = {
            taskPath:          taskPath,
            encodedTaskPath:   encodeURIComponent(taskPath),
            total:             task.total,
            completed:         task.completed,
            passed:            task.completed - failedTaskReports.length,
            failed:            failedTaskReports.length,
            reports:           reports,
            failedTaskReports: failedTaskReports
        };

        res.render('report');
    }


    //Test running
    async _runDir (res, dir) {
        var relativeDir = path.relative('/fixtures', '/' + dir + '/');
        var testsPath   = path.join(this.basePath, relativeDir);
        var tests       = await getTests(testsPath, path.join(this.basePath));

        if (!tests.length)
            return res.redirect(302, this.basePath + dir);

        await this._runTests(res, tests, relativeDir);
    }

    async _runTests (res, tests, dir) {
        var task = {
            id:        ++this.tasksCounter,
            path:      path.join('/fixtures', dir || ''),
            tests:     tests,
            total:     tests.length,
            completed: 0,
            reports:   []
        };

        this.tasks[task.id] = task;

        await this._runTest(res, tests[0], task.id);
    }

    async _runTest (res, testPath, taskId) {
        var test   = await fs.readfile(testPath, 'utf-8');
        var markup = '';

        if (/-test$/.test(path.dirname(testPath))) {
            var markupFileName = testPath.replace('-test.js', '.html');

            if (await fs.stat(markupFileName))
                markup = await fs.readfile(markupFileName, 'utf-8');
        }

        var hostname            = this.hostname;
        var crossDomainHostname = this.crossDomainHostname;
        var relativeTestPath    = path.relative(this.basePath, testPath);
        var globals             = mustache.render(this.globalsTemplate, {
            crossDomainHostname: crossDomainHostname,
            path:                encodeURIComponent(pathToUrl(relativeTestPath)),
            testFullPath:        encodeURIComponent(testPath.replace(/\\/g, '\\\\')),
            taskId:              taskId,
            hostname:            hostname
        });

        res.locals = {
            markup:         markup,
            test:           test,
            taskId:         taskId || '',
            globals:        globals,
            qunitSetup:     mustache.render(this.qunitSetupTemplate, { taskId }),
            storeGlobals:   mustache.render(this.storeGlobalsTemplate),
            restoreGlobals: mustache.render(this.restoreGlobalsTemplate),
            scripts:        this.testResources.scripts,
            css:            this.testResources.css
        };
        res.render('test');
    }


    //API
    fixtures (basePath) {
        this.basePath = basePath;
        return this;
    }

    port (port) {
        this.serverPort = port;

        return this;
    }

    crossDomainPort (port) {
        this.crossDomainServerPort = port;

        return this;
    }

    scripts (scripts) {
        if (Array.isArray(scripts))
            scripts.forEach(script => this._registerScript(script));
        else this._registerScript(scripts);

        return this;
    }

    css (css) {
        if (Array.isArray(css))
            css.forEach(css => this._registerCss(css));
        else this._registerCss(css);

        return this;
    }

    configApp (config) {
        config(this.app);
        config(this.crossDomainApp);

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
            urls:      [this.localhostname + '/start'],
            timeout:   settings.timeout || curSettings.timeout || 30
        };

        return this;
    }

    create () {
        if (!this.basePath)
            throw 'fixtures path is not defined';

        this._createServers();
        this._setupRoutes();

        console.log('QUnit server listens on', this.hostname);

        return this;
    }

    tests (tests) {
        this.pendingTests = tests;
        return this;
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

        try {
            saucelabs.closeTunnel(tunnel);
        }
        catch (err) {
            console.log('ERROR: Can not close saucelabs tunnel:', err);
        }

        if (error)
            throw error;

        try {
            var reportRes = reportSauceLabsTests(report);

        }
        catch (err) {
            console.log('ERROR: Can not create the report:', err);
        }

        if (!reportRes)
            throw 'tests failed';
    }

    close () {
        this.appServer.close();
        this.crossDomainAppServer.close();
    }
};
