import { httpsRequest } from './https-request';

export default class SaucelabsRequestAdapter {
    constructor (user, pass) {
        this.user = user;
        this.pass = pass;
    }

    static URLS = {
        RUN:         'js-tests',
        STATUS:      'js-tests/status',
        STOP_JOB:    jobId => `jobs/${jobId}/stop`,
        CONCURRENCY: 'concurrency'
    };

    async _request (params, data) {
        var result = await httpsRequest(params, data);

        var statusCode = result.statusCode;
        var body       = result.body;

        if (statusCode >= 200 && statusCode <= 299)
            return body;

        throw [
            'Unexpected response from the Sauce Labs API.',
            params.method + ' ' + params.hostname,
            'Response status: ' + statusCode,
            'Body: ' + JSON.stringify(body)
        ].join('\n');
    }

    async put (url, data) {
        var params = {
            method:   'PUT',
            hostname: `api.us-west-1.saucelabs.com`,
            path:     `/rest/${url}`,
            headers:  { 'Content-Type': 'application/json' },
            auth:     this.user + ':' + this.pass
        }

        return await this._request(params, JSON.stringify(data));
    }

    async get (url) {
        var params = {
            method:   'GET',
            hostname: `api.us-west-1.saucelabs.com`,
            path:     `/rest/v1.2/users/${this.user}/${url}`,
            headers:  { 'Content-Type': 'application/json' },
            auth:     this.user + ':' + this.pass
        }

        var body = await this._request(params);

        return JSON.parse(body);
    }
}
