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

    wait: function (condition, ms) {
        return new Promise(function (resolve) {
            var timeoutId  = null;
            var intervalId = null;

            timeoutId = window.setTimeout(function () {
                window.clearInterval(intervalId);
                window.clearTimeout(timeoutId);
                ok(false, 'Timeout error');
                start();
            }, ms === void 0 ? WAIT_TIMEOUT : ms);

            intervalId = window.setInterval(function () {
                if (condition()) {
                    window.clearInterval(intervalId);
                    window.clearTimeout(timeoutId);
                    resolve();
                }
            }, CHECK_PREDICATE_INTERVAL);
        });
    },

    waitForIframe: function (iframe, timeout) {
        return new Promise(function (resolve, reject) {
            var timeoutId      = null;
            var isIframeLoaded = false;

            function loadEventHandler () {
                window.clearTimeout(timeoutId);
                iframe.removeEventListener('load', loadEventHandler);
                resolve();
            }

            if (!iframe || !iframe.tagName || iframe.tagName.toLowerCase() !== 'iframe')
                throw 'Incorrect waitForIframe argument';

            timeoutId = window.setTimeout(function () {
                window.clearTimeout(timeoutId);
                iframe.removeEventListener('load', loadEventHandler);
                ok(false, 'Timeout error');
                start();
            }, timeout === void 0 ? WAIT_FOR_IFRAME_TIMEOUT : timeout);

            try {
                isIframeLoaded = iframe.contentWindow && iframe.contentWindow.document &&
                                 iframe.contentWindow.document.readyState === 'complete';
            }
            catch (e) {
                //NOTE: if cross-domain iframe raises an error we take it as loaded
                isIframeLoaded = true
            }

            if (isIframeLoaded) {
                window.clearTimeout(timeoutId);
                resolve();
                return;
            }

            iframe.addEventListener('load', loadEventHandler);
        });
    },

    WAIT_FOR_IFRAME_TIMEOUT: WAIT_FOR_IFRAME_TIMEOUT
};
