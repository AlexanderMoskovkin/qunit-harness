var Promise = require('pinkie');

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
            }, 3000);

            intervalId = window.setInterval(function () {
                if (condition()) {
                    window.clearInterval(intervalId);
                    window.clearTimeout(timeoutId);
                    resolve();
                }
            }, 50);
        });
    }
};
