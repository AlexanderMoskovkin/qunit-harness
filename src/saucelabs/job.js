import SaucelabsRequestAdapter from './request';
import wait from '../utils/wait';

const CHECK_RESULTS_TIMEOUT = 1000 * 20;


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

        this.taskId = null;
        this.status = Job.STATUSES.INITIALIZED;
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
                        var result = body['js tests'] && body['js tests'][0];

                        if (body.completed)
                            job.status = Job.STATUSES.COMPLETED;
                        else if (result)
                            job.status = result.status.indexOf('queued') > -1 ?
                                         Job.STATUSES.QUEUED : Job.STATUSES.IN_PROGRESS;

                        if (!body.completed) {
                            return wait(CHECK_RESULTS_TIMEOUT)
                                .then(checkStatus);
                        }

                        resolve(result);
                    });
            }

            checkStatus();
        });
    }

    _restartTask () {

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
