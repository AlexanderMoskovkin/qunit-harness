import Promise from 'promise';
import request from 'request';


const CHECK_RESULTS_TIMEOUT = 1000 * 2;
const REPORTING_TIMEOUT     = 1000 * 30;


//Utils
var requestPromised = Promise.denodeify(request);

async function sendRequest (params) {
    var result = await requestPromised(params);

    var statusCode = result.statusCode;
    var body       = result.body;

    if (statusCode !== 200) {
        throw [
            'Unexpected response from the Sauce Labs API.',
            params.method + ' ' + params.url,
            'Response status: ' + statusCode,
            'Body: ' + JSON.stringify(body)
        ].join('\n');
    }

    return body;
}

function wait (ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

//Adapter

export default class SauceLabsAdapter {
    constructor (options) {
        var browsers = options.browsers || [];

        browsers = browsers.map(function (item) {
            return [item.platform || '', item.browserName || '', item.version || ''];
        });

        this.options = {
            username:  options.username || '',
            accessKey: options.accessKey || '',
            build:     options.build || Date.now(),
            browsers:  browsers,
            testName:  options.name || 'QUnit tests',
            tags:      options.tags || ['master'],
            urls:      options.urls || [],
            timeout:   options.timeout || '',

            tunnelIdentifier: options.tunnelIdentifier ||
                              Math.floor((new Date()).getTime() / 1000 - 1230768000).toString()

        };

        this.tasks             = [];
        this.reportingInterval = null;
    }

    _report () {
        var total      = this.tasks.length;
        var queued     = this.tasks.filter(task => task.status === 'queued').length;
        var inProgress = this.tasks.filter(task => task.status === 'progress').length;
        var completed  = this.tasks.filter(task => task.status === 'completed').length;

        console.log(`Tasks total: ${total}, queued: ${queued}, in progress: ${inProgress}, completed: ${completed}`);
    }

    _runReporting () {
        var accountUrl = `https://saucelabs.com/u/${this.options.username}`;

        console.log(`See the progress: ${accountUrl} (session: "${this.options.testName}", build: "${this.options.build}")`);
        this._report();

        this.reportingInterval = setInterval(()=>this._report(), REPORTING_TIMEOUT);
    }

    async _startTask (browsers, url) {
        var params = {
            method: 'POST',
            url:    ['https://saucelabs.com/rest/v1', this.options.username, 'js-tests'].join('/'),
            auth:   { user: this.options.username, pass: this.options.accessKey },

            json: {
                platforms:           browsers,
                url:                 url,
                framework:           'qunit',
                passed:              true,
                public:              'public',
                build:               this.options.build,
                tags:                this.options.tags,
                name:                this.options.testName,
                'tunnel-identifier': this.options.tunnelIdentifier,
                'max-duration':      this.options.timeout
            }
        };

        var body    = await sendRequest(params);
        var taskIds = body['js tests'];

        if (!taskIds || !taskIds.length)
            throw 'Error starting tests through Sauce API: ' + JSON.stringify(body);

        this.tasks = taskIds.map(id => {
            return { id, status: 'queued' };
        });

        this._runReporting();

        return taskIds;
    }

    _completeTask (taskId) {
        return this._waitForTaskCompleted(taskId);
    }

    _waitForTaskCompleted (taskId) {
        var runner = this;
        var params = {
            method: 'POST',
            url:    ['https://saucelabs.com/rest/v1', runner.options.username, 'js-tests/status'].join('/'),
            auth:   { user: runner.options.username, pass: runner.options.accessKey },
            json:   { 'js tests': [taskId] }
        };

        return new Promise(function (resolve, reject) {
            function checkResult () {
                sendRequest(params)
                    .then(function (body) {
                        var result = body['js tests'] && body['js tests'][0];
                        var status = null;

                        if (body.completed)
                            status = 'completed';
                        else if (result)
                            status = result.status.indexOf('queued') > -1 ? 'queued' : 'progress';

                        runner.tasks.filter(task => task.id === taskId)[0]['status'] = status;

                        if (!body.completed) {
                            return wait(CHECK_RESULTS_TIMEOUT)
                                .then(checkResult);
                        }

                        resolve(result);
                    });
            }

            checkResult();
        });
    }

    runTests () {
        var runner = this;

        var runTaskPromises = this.options.urls.map(function (url) {
            return runner._startTask(runner.options.browsers, url)
                .then(function (taskIds) {
                    var completeTaskPromises = taskIds.map(function (id) {
                        return runner._completeTask(id);
                    });

                    return Promise.all(completeTaskPromises);
                })
                .then(function (result) {
                    clearInterval(runner.reportingInterval);
                    return result;
                });
        });

        return Promise.all(runTaskPromises)
            .catch(function (err) {
                throw 'RUN TESTS ERROR: ' + err;
            });
    }
}
