import promisifyEvent from 'promisify-event';
import { EventEmitter } from 'events';
import Job from './job';

const REPORTING_TIMEOUT = 1000 * 30;

export default class CLIRunner extends EventEmitter {
    constructor (options, testServer) {
        super();

        this.options                  = options;
        this.testServer               = testServer;
        this.jobs                     = [];
        this.jobResults               = [];
        this.reportingInterval        = null;
        this.freeMachineCheckInterval = null;
    }

    _getQueuedJobs () {
        return this.jobs.filter(job => job.getStatus() === Job.STATUSES.INITIALIZED);
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

    _outputCurrentTaskStatus () {
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

    _runCurrentTaskStatusReporting () {
        this.reportingInterval = setInterval(() => this._outputCurrentTaskStatus(), REPORTING_TIMEOUT);
    }

    async _startJobs () {
        var jobs = this._getQueuedJobs();

        jobs.forEach(job => {
            job
                .run()
                .then(result => {
                    this.jobResults = this.jobResults.concat(result);

                    this.emit('job-done')
                })
                .catch(console.log);
        });
    }

    async runTests () {
        this.jobs = this.options.browsers.map(browser => new Job(this.options, browser, this.testServer));

        let completedJobs = 0;

        this._runCurrentTaskStatusReporting();

        try {
            var jobsDonePromise = promisifyEvent(this, 'done');

            this._startJobs();

            this.on('job-done', () => {
                if (++completedJobs === this.jobs.length) this.emit('done');
            });

            await jobsDonePromise;

            clearInterval(this.reportingInterval);
        }
        catch (err) {
            clearInterval(this.reportingInterval);

            throw 'RUN TESTS ERROR: ' + err;
        }

        return this.jobResults;
    }
}
