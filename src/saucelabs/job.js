import WebDriver from 'webdriver';
import { assign } from 'lodash';
import SaucelabsRequestAdapter from './request';
import wait from '../utils/wait';
import isSafari15 from '../utils/is-safari-15';


const CHECK_TEST_RESULT_DELAY = 10 * 1000;
const MAX_JOB_RESTART_COUNT   = 3;
const BROWSER_INIT_RETRIES    = 3;
const BROWSER_INIT_TIMEOUT    = 9 * 60 * 1000;

// NOTE: Saucelabs cannot start tests in Safari 15 immediately.
// So, we are forced to add delay before test execution.
const TEST_RUN_DELAY_FOR_SAFARI_15 = 30 * 1000;

//Job
export default class Job {
    constructor (options, browserInfo) {
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
        this.browserInfo    = browserInfo;
        
        this.browser        = null;

        this.status         = Job.STATUSES.INITIALIZED;
        this.restartCount   = 0;
        this.startTestsTime = null;

        var platformName   = browserInfo.platform || browserInfo.platformName || '';
        var browserName    = browserInfo.browserName || '';
        var plaformVersion = browserInfo.version || browserInfo.platformVersion || '';

        this.platform = [platformName, browserName, plaformVersion];
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
                testResult = await this.browser.executeScript('return window.global_test_results', []);
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
            this._reportError(`An error occurred while the test result was being published: ${error}`);
        }

        return {
            url:      `https://saucelabs.com/jobs/${this.browser.sessionId}`,
            platform: this.platform,
            result:   testResult,
            job_id:   this.browser.sessionId
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

        await this.requestAdapter.put(`/v1/${this.options.username}/jobs/${this.browser.sessionId}`, data);
    }

    async run () {
        var jobResult = null;
        var jobFailed = false;

        var initBrowserParams = {
            name:             this.options.testName,
            tags:             this.options.tags,
            build:            this.options.build,
            tunnelIdentifier: this.options.tunnelIdentifier
        };

        assign(initBrowserParams, this.browserInfo);

        this.status = Job.STATUSES.INIT_BROWSER;

        try {
            this.browser = await WebDriver.newSession({
                protocol:               'http',
                hostname:               'ondemand.saucelabs.com',
                port:                   80,
                user:                   this.options.username,
                key:                    this.options.accessKey,
                capabilities:           initBrowserParams,
                logLevel:               'error',
                connectionRetryTimeout: BROWSER_INIT_TIMEOUT,
                connectionRetryCount:   BROWSER_INIT_RETRIES,
                path:                   '/wd/hub',
                automationProtocol:     'webdriver'
            });

            if (isSafari15(initBrowserParams))
                await wait(TEST_RUN_DELAY_FOR_SAFARI_15);

            await this.browser.navigateTo(this.options.urls[0]);
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
                await this.browser.deleteSession();
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
                    job_id:   this.browser.sessionId
                };

                if (this.status === Job.STATUSES.IN_PROGRESS)
                    jobResult.url = `https://saucelabs.com/jobs/${this.browser.sessionId}`;

                this.status = Job.STATUSES.FAILED;
            }
        }

        return jobResult;
    }

    getStatus () {
        return this.status;
    }
}
