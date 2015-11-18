import Promise from 'pinkie';
import SaucelabsRequestAdapter from './request';
import wait from '../utils/wait';

const CHECK_RESULTS_TIMEOUT = 1000 * 20;
const MAX_RESTART_COUNT     = 3;


//Job
export default class Job {
    constructor (options, platform) {
        this.options = {
            username:         options.username,
            accessKey:        options.accessKey,
            build:            options.build,
            testName:         options.name,
            tags:             options.tags,
            urls:             options.urls,
            timeout:          options.timeout,
            tunnelIdentifier: options.tunnelIdentifier
        };

        this.requestAdapter = new SaucelabsRequestAdapter(this.options.username, this.options.accessKey);
        this.platform       = platform;

        this.taskId       = null;
        this.status       = Job.STATUSES.INITIALIZED;
        this.restartCount = 0;
    }

    static STATUSES = {
        INITIALIZED: 'initialized',
        QUEUED:      'queued',
        IN_PROGRESS: 'in progress',
        COMPLETED:   'completed',
        FAILED:      'failed'
    };

    _waitForComplete () {
        var job               = this;
        var statusRequestData = {
            'js tests': [this.taskId]
        };

        return new Promise(function (resolve, reject) {
            function checkStatus () {
                job.requestAdapter.send(SaucelabsRequestAdapter.URLS.STATUS, statusRequestData)
                    .then(function (body) {
                        var result  = body['js tests'] && body['js tests'][0];
                        var restart = false;

                        if (body.completed) {
                            if (typeof result.result === 'string' &&
                                result.result.indexOf('Test exceeded maximum duration') > -1) {
                                job._reportError(result.result + ' ' + result.url);
                                restart = true;
                            }
                            else {
                                job.status = Job.STATUSES.COMPLETED;
                                resolve(result);
                            }
                        }
                        else {
                            var status = result.status;

                            if (status === 'test error') {
                                job._reportError('saucelabs environment error');
                                restart = true;
                            }

                            if (status.indexOf('queued') > -1)
                                job.status = Job.STATUSES.QUEUED;

                            if (status.indexOf('in progress') > -1)
                                job.status = Job.STATUSES.IN_PROGRESS;

                            if (!restart)
                                wait(CHECK_RESULTS_TIMEOUT).then(checkStatus);
                        }

                        if (restart) {
                            if (++job.restartCount < MAX_RESTART_COUNT) {
                                job._restartTask()
                                    .then(resolve);
                            }
                            else {
                                result.result = 'Tests failed (see the log)';
                                resolve(result);
                            }
                        }
                    });
            }

            checkStatus();
        });
    }

    _reportError (error) {
        console.log(`The task (${this.platform}) failed: ${error}`);
    }

    _restartTask () {
        console.log(`Attempt ${this.restartCount} to restart the task (${this.platform})`);
        this.requestAdapter.send(SaucelabsRequestAdapter.URLS.STOP_JOB(this.taskId), {});

        return this.run();
    }


    run () {
        var job            = this;
        var runRequestData = {
            platforms:           [this.platform],
            url:                 this.options.urls[0],
            framework:           'qunit',
            passed:              true,
            public:              'public',
            build:               this.options.build,
            tags:                this.options.tags,
            name:                this.options.testName,
            'tunnel-identifier': this.options.tunnelIdentifier,
            'max-duration':      this.options.timeout
        };

        return this.requestAdapter.send(SaucelabsRequestAdapter.URLS.RUN, runRequestData)
            .then(function (body) {
                var taskIds = body['js tests'];

                if (!taskIds || !taskIds.length)
                    throw 'Error starting tests through Sauce API: ' + JSON.stringify(body);

                job.taskId = taskIds[0];

                return job._waitForComplete();
            });
    }

    getStatus () {
        return this.status;
    }
}
