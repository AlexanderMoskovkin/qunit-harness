import Promise from 'pinkie';
import Job from './job';
import wait from '../utils/wait';


const REPORTING_TIMEOUT = 1000 * 30;


export default class SauceLabsRunner {
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

        this.jobs              = [];
        this.reportingInterval = null;
    }

    _report () {
        var total      = this.jobs.length;
        var queued     = this.jobs.filter(job => job.getStatus() === Job.STATUSES.QUEUED).length;
        var inProgress = this.jobs.filter(job => job.getStatus() === Job.STATUSES.IN_PROGRESS).length;
        var completed  = this.jobs.filter(job => job.getStatus() === Job.STATUSES.COMPLETED).length;
        var failed     = this.jobs.filter(job => job.getStatus() === Job.STATUSES.FAILED).length;

        var message = `Tasks total: ${total}, queued: ${queued}, in progress: ${inProgress}, completed: ${completed}`;

        if (failed)
            message += `, failed: ${failed}`;

        console.log(message);
    }

    _runReporting () {
        var accountUrl = `https://saucelabs.com/u/${this.options.username}`;

        console.log(`See the progress: ${accountUrl} (session: "${this.options.testName}", build: "${this.options.build}")`);

        this.reportingInterval = setInterval(()=>this._report(), REPORTING_TIMEOUT);
    }

    runTests () {
        var runner = this;

        var runJobPromises = this.options.browsers.map(function (browser, index) {
            var job = new Job(runner.options, browser);

            runner.jobs.push(job);
            return wait(index * 1000)
                .then(function () {
                    return job.run();
                });
        });

        this._runReporting();

        return Promise.all(runJobPromises)
            .then(function (res) {
                clearInterval(runner.reportingInterval);
                return res;
            })
            .catch(function (err) {
                throw 'RUN TESTS ERROR: ' + err;
            });
    }
}
