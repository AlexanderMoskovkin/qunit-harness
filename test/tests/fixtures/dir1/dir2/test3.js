test('Simple test', function () {
    eq(1, 1);
});

/*
test('test with markup', function () {
    var $element = $('#test-element');

    eq($element.length, 1);
});

asyncTest('test with data', function () {
    expect(1);

    var $iframe = $('<iframe></iframe>').attr('src', window.QUnitGlobals.hostname + '/data/iframe.html')
        .load(function () {
            eq($iframe.contents().find('#iframe-element').length, 1);
            start();
        });
});

asyncTest('test ping requests', function () {
    expect(2);

    var requestCounter = 0;
    var delay          = 50;

    function sendPingRequest (url) {
        requestCounter++;

        $.ajax({
            type:     'POST',
            url:      url,
            callback: function (data) {
                eq(data, delay);

                if (!(--requestCounter))
                    start();
            }
        });
    }

    sendPingRequest(window.QUnitGlobals.hostname + 'ping/' + delay);
    sendPingRequest(window.QUnitGlobals.crossDomainHostname + 'ping/' + delay);
});

test('test resources', function () {
    ok(window.resourceLoaded);
});
*/
