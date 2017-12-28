import chalk from 'chalk';


function checkFailures (results) {
    var globalErrors = [];
    var testErrors   = [];

    results.forEach(function ({ platform, result }) {
        var msg          = [];
        var runningError = !result || typeof result === 'string';
        var failed       = runningError || result.failed;

        msg.push(chalk.bold(failed ? chalk.red('FAILURES:') : chalk.green('OK:')));
        msg.push(chalk.bold('Worker:'));
        msg.push(`"${platform}"`);

        if (runningError) {
            var resultErrorMessage = 'There is no test result available.';

            msg.push(chalk.bold(resultErrorMessage));
            globalErrors.push(resultErrorMessage);
        }
        else {
            msg.push(chalk.bold('Total:'), result.total);
            msg.push(chalk.bold('Failed:'), result.failed);

            var tests = result.reports.reduce((prev, curr) => {
                return prev.concat(curr.result.tests);
            }, []);

            if (tests.some(test => !!test.failed))
                msg.push(chalk.bold(chalk.red('\nERRORS:')));

            tests.forEach(test => {
                if (!test.failed)
                    return;

                test.assertions.forEach(assertion => {
                    if (assertion.failed) {
                        var assertionName = assertion.name ? `\n${chalk.bold('Assertion:')} "${assertion.name}"` : '';
                        var moduleName    = assertion.module ? `\n${chalk.bold('Module:')}} "${assertion.module}}"` : '';
                        var source        = assertion.source ? '\n' + assertion.source.replace(/-----> \\n/g, '\n')
                            : '';

                        msg.push(`
"${test.name}" failed.${moduleName}${assertionName}

${chalk.bold('Message:')} ${assertion.message}
${chalk.bold('Expected:')} ${assertion.expected}
${chalk.bold('Actual:')} ${assertion.actual}
${source}
`);
                    }
                });
            });
        }

        console.log(msg.join(' '));
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
