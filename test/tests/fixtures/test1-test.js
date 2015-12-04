var localVar = 'local';

test('Simple test', function () {
    equal(1, 1);
});

test('Do not pollute window obj', function () {
    notEqual(window.localVar, localVar);
});

asyncTest('test with data', function () {
    expect(1);

    var iframeUrl = window.QUnitGlobals.getResourceUrl('../data/iframe.html');

    var $iframe = $('<iframe></iframe>')
        .attr('src', iframeUrl)
        .load(function () {
            equal($iframe.contents().find('#iframe-element').length, 1);
            $iframe.remove();
            start();
        })
        .appendTo('body');
});

asyncTest('test ping requests', function () {
    expect(1);

    var requestCounter = 0;
    var delay          = 50;

    function sendPingRequest (url) {
        requestCounter++;

        $.ajax({
            type:    'POST',
            url:     url,
            success: function (data) {
                equal(data, delay);

                if (!--requestCounter)
                    start();
            }
        });
    }

    sendPingRequest(window.QUnitGlobals.hostname + '/ping/' + delay);
});

asyncTest('test cross-domain iframe', function () {
    var iframeUrl = window.QUnitGlobals.getResourceUrl('../data/cross-domain.html');

    var $iframe = $('<iframe></iframe>')
        .attr('src', window.QUnitGlobals.crossDomainHostname + iframeUrl)
        .appendTo('body');

    var timeout = 50;

    expect(1);

    function onmessage (e) {
        if (e.data.type === 'ready')
            $iframe[0].contentWindow.postMessage('/ping/' + timeout, '*');

        if (e.data.type === 'pingResponse') {
            strictEqual(e.data.response, timeout.toString());

            window.removeEventListener('message', onmessage);
            $iframe.remove();
            start();
        }
    }

    window.addEventListener('message', onmessage);
});

asyncTest('test resources', function () {
    expect(5);

    var iframeUrl = window.QUnitGlobals.getResourceUrl('../data/iframe.html', 'testIFrame');

    ok(iframeUrl.indexOf('testIFrame') > -1);

    var $iframe = $('<iframe></iframe>')
        .attr('src', window.QUnitGlobals.hostname + iframeUrl)
        .load(function () {
            var iframeContents = $iframe.contents()[0];

            var $el100px       = $('<div></div>').addClass('element-100-px').appendTo('body');
            var $el100pxIFrame = $('<div></div>').addClass('element-100-px').appendTo(iframeContents.body);

            equal($el100px.width(), 100);
            equal($el100pxIFrame.width(), 100);

            ok(window.resourceLoaded);
            ok($iframe[0].contentWindow.resourceLoaded);

            $iframe.remove();
            start();
        })
        .appendTo('body');
});

asyncTest('configure app', function () {
    expect(2);

    var iframeUrl = window.QUnitGlobals.getResourceUrl('../data/cross-domain.html');

    var $iframe = $('<iframe></iframe>')
        .attr('src', window.QUnitGlobals.crossDomainHostname + iframeUrl)
        .appendTo('body');

    var data              = 'test-data';
    var customUrl         = '/custom/' + data;
    var expectedResponses = 2;

    function onResponse (resData) {
        strictEqual(resData, data);

        if (!--expectedResponses)
            start();
    }

    $.ajax({
        type:        'POST',
        url:         customUrl,
        contentType: 'application/json',
        success:     onResponse
    });

    function onmessage (e) {
        if (e.data.type === 'ready')
            $iframe[0].contentWindow.postMessage(window.QUnitGlobals.crossDomainHostname + customUrl, '*');

        if (e.data.type === 'pingResponse') {
            window.removeEventListener('message', onmessage);
            $iframe.remove();

            onResponse(e.data.response);
        }
    }

    window.addEventListener('message', onmessage);
});

asyncTest('test with waiting', function () {
    var resolved = false;

    window.setTimeout(function () {
        resolved = true;
    }, 50);

    window.QUnitGlobals.wait(function () {
        return resolved;
    }).then(function () {
        ok(true);
        start();
    });
});

asyncTest('test with waiting for iframe', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.QUnitGlobals.getResourceUrl('../data/iframe.html');

    window.setTimeout(function () {
        document.body.appendChild(iframe);
    }, 500);

    window.QUnitGlobals.waitForIframe(iframe).then(function () {
        ok(true);
        start();
    });
});

asyncTest('test with waiting for cross-domain iframe', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.QUnitGlobals.crossDomainHostname +
                 window.QUnitGlobals.getResourceUrl('../data/cross-domain.html');

    document.body.appendChild(iframe);

    window.setTimeout(function () {
        window.QUnitGlobals.waitForIframe(iframe).then(function () {
            ok(true);
            start();
        });
    }, 100);
});
