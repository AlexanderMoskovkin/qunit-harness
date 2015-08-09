import path from 'path';
import readDir from './read-dir';

async function getTests (dirPath, basePath) {
    basePath = basePath || dirPath;

    var { dirs, files } = await readDir(dirPath);
    var tests = files.map(item => path.join(dirPath, item).replace(basePath, ''));

    var index = 0;

    while (dirs[index])
        tests = tests.concat(await getTests(path.join(dirPath, dirs[index++]), basePath));

    return tests;
}

export default getTests;
