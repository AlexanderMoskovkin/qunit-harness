import Promise from 'pinkie';
import request from 'request';
import promisify from 'pify';

var requestPromised = promisify(request, Promise);

export default class SaucelabsRequestAdapter {
    constructor (user, pass) {
        this.user = user;
        this.pass = pass;
    }

    static URLS = {
        RUN:      'js-tests',
        STATUS:   'js-tests/status',
        STOP_JOB: jobId => `jobs/${jobId}/stop`
    };

    async send (url, data) {
        var params = {
            method: 'POST',
            url:    ['https://saucelabs.com/rest/v1', this.user, url].join('/'),
            auth:   { user: this.user, pass: this.pass },
            json:   data
        };

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
}
