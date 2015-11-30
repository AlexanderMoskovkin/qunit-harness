var Promise = require('pinkie');

var WAIT_TIMEOUT             = 3000;
var WAIT_FOR_IFRAME_TIMEOUT  = 10000;
var CHECK_PREDICATE_INTERVAL = 50;

window.QUnitGlobals = {
    _taskId:   '{{{taskId}}}',
    _path:     '{{{path}}}',
    _fullPath: '{{{testFullPath}}}',

    hostname:            '{{{hostname}}}',
    crossDomainHostname: '{{{crossDomainHostname}}}',

    getResourceUrl: function (filePath, resourceName) {
        return [
            '/test-resource',
            resourceName ? '/' + resourceName : '',
            '?filePath=',
            encodeURIComponent(filePath),
            '&base=',
            window.QUnitGlobals._fullPath
        ].join('');
    },

    wait: function (condition) {
        return new Promise(function (resolve, reject) {
            var timeoutId  = null;
            var intervalId = null;

            timeoutId = window.setTimeout(function () {
                window.clearInterval(intervalId);
                window.clearTimeout(timeoutId);
                ok(false, 'Timeout error');
                start();
            }, WAIT_TIMEOUT);

            intervalId = window.setInterval(function () {
                if (condition()) {
                    window.clearInterval(intervalId);
                    window.clearTimeout(timeoutId);
                    resolve();
                }
            }, CHECK_PREDICATE_INTERVAL);
        });
    },

    waitForIframe: function (iframe) {
        return new Promise(function (resolve, reject) {
            var timeoutId  = null;
            var intervalId = null;

            timeoutId = window.setTimeout(function () {
                window.clearTimeout(timeoutId);
                ok(false, 'Timeout error');
                start();
            }, WAIT_FOR_IFRAME_TIMEOUT);

            intervalId = window.setInterval(function () {
                if (iframe && iframe.contentWindow) {
                    window.clearInterval(intervalId);

                    iframe.contentWindow.addEventListener('load', function () {
                        window.clearTimeout(timeoutId);
                        resolve();
                    });
                }
            }, CHECK_PREDICATE_INTERVAL);
        });
    }
};
