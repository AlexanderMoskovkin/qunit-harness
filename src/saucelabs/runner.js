import Promise from 'pinkie';
import promisifyEvent from 'promisify-event';
import { EventEmitter } from 'events';
import Job from './job';
import wait from '../utils/wait';
import SaucelabsRequestAdapter from './request';

const REPORTING_TIMEOUT                = 1000 * 30;
const WAITING_FOR_FREE_MACHINE_TIMEOUT = 1000 * 60;


export default class SauceLabsRunner extends EventEmitter {
    constructor (options) {
        super();

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

        this.requestAdapter = new SaucelabsRequestAdapter(this.options.username, this.options.accessKey);

        this.jobs                     = [];
        this.jobResults               = [];
        this.reportingInterval        = null;
        this.freeMachineCheckInterval = null;
    }

    _getQueuedJobs (count) {
        return this.jobs
            .filter(job => job.getStatus() === Job.STATUSES.INITIALIZED)
            .splice(0, count);
    }

    _getInProgressJobsCount () {
        return this.jobs.filter(job => job.getStatus() === Job.STATUSES.IN_PROGRESS).length;
    }

    _getCompletedJobsCount () {
        return this.jobs.filter(job => job.getStatus() === Job.STATUSES.COMPLETED).length;
    }

    _getFailedJobsCount () {
        return this.jobs.filter(job => job.getStatus() === Job.STATUSES.FAILED).length;
    }

    _report () {
        var total      = this.jobs.length;
        var inProgress = this._getInProgressJobsCount();
        var completed  = this._getCompletedJobsCount();
        var failed     = this._getFailedJobsCount();
        var queued     = total - inProgress - completed - failed;

        var message = `Tasks total: ${total}, queued: ${queued}, in progress: ${inProgress}, completed: ${completed}`;

        if (failed)
            message += `, failed: ${failed}`;

        console.log(message);
    }

    _runReporting () {
        var accountUrl = `https://saucelabs.com/u/${this.options.username}`;

        console.log(`See the progress: ${accountUrl} (session: "${this.options.testName}", build: "${this.options.build}")`);

        this.reportingInterval = setInterval(() => this._report(), REPORTING_TIMEOUT);
    }

    async _getFreeMachineCount () {
        var response = await this.requestAdapter.get(SaucelabsRequestAdapter.URLS.CONCURRENCY);

        var machineLimit         = response.concurrency.self.allowed.overall;
        var reservedMachineCount = response.concurrency.self.current.overall;

        return machineLimit - reservedMachineCount;
    }

    async _checkForFreeMachines () {
        var freeMachinesCount = await this._getFreeMachineCount();

        if (freeMachinesCount)
            this.emit('free-machines-found', { count: freeMachinesCount });
    }

    async _startNextJobs (count) {
        var jobs = this._getQueuedJobs(count);

        if (jobs.length) {
            jobs.forEach(job => {
                job
                    .run()
                    .then(result => {
                        this.jobResults = this.jobResults.concat(result);

                        this.emit('job-done')
                    });
            });
        }
        else {
            if (this.freeMachineCheckInterval) {
                clearInterval(this.freeMachineCheckInterval);

                this.freeMachineCheckInterval = null;
            }

            var jobsComplete = this._getCompletedJobsCount() + this._getFailedJobsCount() === this.jobs.length;

            if (jobsComplete)
                this.emit('done');
        }
    }

    async _startFreeMachineChecker () {
        this._checkForFreeMachines();

        this.freeMachineCheckInterval = setInterval(() => this._checkForFreeMachines(), WAITING_FOR_FREE_MACHINE_TIMEOUT);
    }

    async runTests () {
        this.jobs = this.options.browsers.map(browser => new Job(this.options, browser));

        this._runReporting();

        try {
            var jobsDonePromise = promisifyEvent(this, 'done');

            this._startFreeMachineChecker();
            this.on('free-machines-found', e => this._startNextJobs(e.count));
            this.on('job-done', () => this._startNextJobs(1));

            await jobsDonePromise;

            clearInterval(this.reportingInterval);
        }
        catch (err) {
            clearInterval(this.freeMachineCheckInterval);
            clearInterval(this.reportingInterval);

            throw 'RUN TESTS ERROR: ' + err;
        }

        return this.jobResults;
    }
}
