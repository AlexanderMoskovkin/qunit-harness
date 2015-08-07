test('Simple test', function () {
    equal(1, 1);
});


test('test with markup', function () {
    var $element = $('#test-element');

    equal($element.length, 1);
});

asyncTest('test with data', function () {
    expect(1);

    var $iframe = $('<iframe></iframe>')
        .attr('src', window.QUnitGlobals.hostname + '/data/iframe.html')
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
    var $iframe = $('<iframe></iframe>')
        .attr('src', window.QUnitGlobals.crossDomainHostname + '/data/cross-domain.html')
        .appendTo('body');

    var timeout = 50;

    expect(1);

    function onmessage (e) {
        if (e.data.type === 'ready')
            $iframe[0].contentWindow.postMessage(timeout, '*');

        if (e.data.type === 'pingResponse') {
            strictEqual(e.data.response, timeout.toString());

            window.removeEventListener(onmessage);
            $iframe.remove();
            start();
        }
    }

    window.addEventListener('message', onmessage);
});

asyncTest('test resources', function () {
    expect(2);

    var $iframe = $('<iframe></iframe>')
        .attr('src', window.QUnitGlobals.hostname + '/data/iframe.html')
        .load(function () {
            ok(window.resourceLoaded);
            ok($iframe[0].contentWindow.resourceLoaded);

            $iframe.remove();
            start();
        })
        .appendTo('body');
});
