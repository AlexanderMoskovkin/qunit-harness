import { close, open } from 'testcafe-browser-tools';
import { spawn } from 'child_process';

const MAX_JOB_RESTART_COUNT = 3;

//Job
export default class Job {
    constructor (options, browser, testServer) {
        this.options = options;

        this.options.timeout *= 1e3;

        this.id = browser.browserName;

        this.browserInfo = browser.browserInfo;
        this.testServer  = testServer;

        this.status         = Job.STATUSES.INITIALIZED;
        this.restartCount   = 0;
        this.startTestsTime = null;
    }

    static STATUSES = {
        INIT_BROWSER: 'init browser',
        INITIALIZED:  'initialized',
        IN_PROGRESS:  'in progress',
        COMPLETED:    'completed',
        FAILED:       'failed'
    };

    async _getTestResult () {
        return new Promise(resolve => {
            this.testServer.on('taskDone', async results => {
                if (results.id === this.sessionID)
                    resolve(results);
            });
        });
    }

    async _getJobResult () {
        this.status = Job.STATUSES.IN_PROGRESS;

        this.startTestsTime = new Date();

        var testResult = await this._getTestResult();

        this.status = Job.STATUSES.COMPLETED;

        return {
            platform: this.id,
            result:   testResult,
            job_id:   this.sessionID
        };
    }

    _reportError (error) {
        console.log(`The task (${this.id}) failed: ${error}`);
    }

    async _runWorker () {
        try {
            await open(this.browserInfo, `${this.options.startUrl[0]}?browserName=${encodeURIComponent(this.id)}`);

            return new Promise(resolve => {
                this.testServer.on('startedWorker', (browserName, id) => {
                    if (this.id === browserName)
                        this.sessionID = id;

                    resolve();
                });
            });
        }

        catch (e) {
            console.log(e);
        }
    }

    async run () {
        var jobResult = null;
        var jobFailed = false;

        this.status = Job.STATUSES.INIT_BROWSER;

        try {
            await this._runWorker();
        }
        catch (error) {
            this._reportError(`An error occurred while the browser was being initialized: ${error}`);
            jobFailed = true;
        }

        if (!jobFailed) {
            try {
                jobResult = await this._getJobResult();
            }
            catch (error) {
                this._reportError(error);
                jobFailed = true;
            }

            try {
                await close(`QUnitReport#${this.sessionID}`);
            }
            catch (error) {
                this._reportError(`An error occurred while the browser was being closed: ${error}`);
            }
        }

        if (jobFailed) {
            if (++this.restartCount < MAX_JOB_RESTART_COUNT) {
                console.log(`Attempt ${this.restartCount} to restart the task(${this.id})`);

                jobResult = await this.run();
            }

            else {
                jobResult = {
                    platform: this.id,
                    job_id:   this.sessionID
                };

                this.status = Job.STATUSES.FAILED;
            }
        }

        return jobResult;
    }

    getStatus () {
        return this.status;
    }
}
