import chalk from 'chalk';


function checkFailures (results) {
    var globalErrors = [];
    var testErrors   = [];

    results.forEach(function (platformResults) {
        var msg      = [];
        var platform = [platformResults.platform[0], platformResults.platform[1], platformResults.platform[2] ||
                                                                                  ''].join(' ');
        var url      = platformResults.url;

        var runningError = !platformResults.result || typeof platformResults.result === 'string';
        var failed       = runningError || platformResults.result.failed;

        msg.push(chalk.bold(failed ? chalk.red('FAILURES:') : chalk.green('OK:')));
        msg.push(platform);

        if (runningError) {
            msg.push(chalk.bold(platformResults.result));
            globalErrors.push(platformResults.result);
        }
        else {
            msg.push(chalk.bold('Total:'), platformResults.result.total);
            msg.push(chalk.bold('Failed:'), platformResults.result.failed);
        }

        msg.push(`(${url})`);

        console.log(msg.join(' '));

        if (!runningError && platformResults.result.errors) {
            //NOTE: https://support.saucelabs.com/customer/en/portal/private/cases/31354
            var errors = typeof platformResults.result.errors.length !== 'undefined' ?
                         platformResults.result.errors :
                         Object.keys(platformResults.result.errors).map(index => platformResults.result.errors[index]);

            errors.forEach(function (error) {
                error.platform = platform;
                testErrors.push(error);
            });
        }
    });

    return { globalErrors, testErrors };
}

function reportTestFailures (errors) {
    console.log(chalk.bold.red('ERRORS:'));

    errors.forEach(function (error) {
        console.log(chalk.bold(error.platform + ' - ' + error.testPath));
        console.log(chalk.bold('Test: ' + error.testName));

        if (error.customMessage)
            console.log('message: ' + error.customMessage);

        if (error.expected) {
            console.log('expected: ' + error.expected);
            console.log('actual: ' + error.actual);
        }

        console.log('-------------------------------------------');
        console.log();
    });
}


export default function (report) {
    var { testErrors, globalErrors } = checkFailures(report);

    if (globalErrors.length)
        return false;

    if (testErrors.length) {
        reportTestFailures(testErrors);
        return false;
    }

    return true;
}
