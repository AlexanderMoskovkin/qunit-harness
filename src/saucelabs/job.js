import wd from 'wd';
import promisifyEvent from 'promisify-event'
import SaucelabsRequestAdapter from './request';
import wait from '../utils/wait';


const CHECK_TEST_RESULT_DELAY  = 10 * 1000;
const MAX_JOB_RESTART_COUNT    = 3;
const BROWSER_INIT_RETRY_DELAY = 30 * 1000;
const BROWSER_INIT_RETRIES     = 3;
const BROWSER_INIT_TIMEOUT     = 9 * 60 * 1000;


wd.configureHttp({
    retryDelay: BROWSER_INIT_RETRY_DELAY,
    retries:    BROWSER_INIT_RETRIES,
    timeout:    BROWSER_INIT_TIMEOUT
});


//Job
export default class Job {
    constructor (options, platform) {
        this.options = {
            username:         options.username,
            accessKey:        options.accessKey,
            build:            options.build,
            testName:         options.testName,
            tags:             options.tags,
            urls:             options.urls,
            tunnelIdentifier: options.tunnelIdentifier,
            testsTimeout:     options.timeout * 1000
        };

        this.requestAdapter = new SaucelabsRequestAdapter(this.options.username, this.options.accessKey);
        this.platform       = platform;
        this.browser        = wd.promiseRemote('ondemand.saucelabs.com', 80, options.username, options.accessKey);

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
        var testResult = null;

        while (!testResult) {
            if (new Date() - this.startTestsTime > this.options.testsTimeout)
                throw new Error('Test exceeded maximum duration');

            await(wait(CHECK_TEST_RESULT_DELAY));

            try {
                testResult = await this.browser.eval('window.global_test_results');
            }
            catch (error) {
                var windowErrorMessage = 'window has no properties';

                // NOTE: this error may occur while testing against internet explorer 11.
                // This may happen because the IE driver sometimes throws an unknown error
                // when executing an expression with the 'window' object.
                var ie11ErrorMessage = [
                    'Error response status: 13, , ',
                    'UnknownError - An unknown server-side error occurred while processing the command. ',
                    'Selenium error: JavaScript error (WARNING: The server did not provide any stacktrace information)'
                ].join('');

                if (error.message.indexOf(windowErrorMessage) < 0 && error.message.indexOf(ie11ErrorMessage) < 0)
                    throw error;
            }
        }

        return testResult;
    }

    async _getJobResult () {
        this.status = Job.STATUSES.IN_PROGRESS;

        this.startTestsTime = new Date();

        var testResult = await this._getTestResult();

        this.status = Job.STATUSES.COMPLETED;

        try {
            await this._publishTestResult(testResult);
        }
        catch (error) {
            this._reportError(`An error occured while the test result was being published: ${error}`);
        }

        return {
            url:      `https://saucelabs.com/jobs/${this.browser.sessionID}`,
            platform: this.platform,
            result:   testResult,
            job_id:   this.browser.sessionID
        };
    }

    _reportError (error) {
        console.log(`The task (${this.platform}) failed: ${error}`);
    }

    async _publishTestResult (testResult) {
        var testSuccess = (testResult.errors.length === 0 || Object.keys(testResult.errors).length === 0)
                          && testResult.failed === 0;

        var data = {
            public:        'public',
            passed:        testSuccess,
            'custom-data': {
                'qunit': testResult
            }
        };

        await this.requestAdapter.put(`/v1/${this.options.username}/jobs/${this.browser.sessionID}`, data);
    }

    async run () {
        var jobResult = null;
        var jobFailed = false;

        var initBrowserParams = {
            name:             this.options.testName,
            tags:             this.options.tags,
            build:            this.options.build,
            platform:         this.platform[0],
            browserName:      this.platform[1],
            version:          this.platform[2],
            tunnelIdentifier: this.options.tunnelIdentifier
        };

        this.status = Job.STATUSES.INIT_BROWSER;

        try {
            var initBrowserPromise = promisifyEvent(this.browser, 'status');

            this.browser.init(initBrowserParams);

            await initBrowserPromise;
            await this.browser.get(this.options.urls[0]);
        }
        catch (error) {
            this._reportError(`An error occured while the browser was being initialized: ${error}`);
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
                await this.browser.quit();
            }
            catch (error) {
                this._reportError(`An error occured while the browser was being closed: ${error}`);
            }
        }

        if (jobFailed) {
            if (++this.restartCount < MAX_JOB_RESTART_COUNT) {
                console.log(`Attempt ${this.restartCount} to restart the task (${this.platform})`);

                jobResult = await this.run();
            }
            else {
                jobResult = {
                    platform: this.platform,
                    job_id:   this.browser.sessionID
                };

                if (this.status === Job.STATUSES.IN_PROGRESS)
                    jobResult.url = `https://saucelabs.com/jobs/${this.browser.sessionID}`;

                this.status = Job.STATUSES.FAILED;
            }
        }

        return jobResult;
    }

    getStatus () {
        return this.status;
    }
}
