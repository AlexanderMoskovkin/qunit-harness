import CLIRunner from './runner';

export async function run (settings, testServer) {
    var runner = new CLIRunner(settings, testServer);

    return await runner.runTests();
}
