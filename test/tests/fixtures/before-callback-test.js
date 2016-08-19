asyncTest('configure app', function () {
    expect(1);

    function onResponse (beforeCallbackCalled) {
        strictEqual(beforeCallbackCalled, true);
        start();
    }

    $.ajax({
        type:        'POST',
        url:         '/get-before-callback-called',
        contentType: 'application/json',
        success:     onResponse
    });
});
