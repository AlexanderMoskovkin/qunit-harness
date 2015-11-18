import Promise from 'pinkie';
import path from 'path';
import * as fs from './fs';

export default async function (dirPath) {
    var dirs  = [];
    var files = [];

    async function processDirItem (item) {
        var subpath = path.join(dirPath, item);

        var stats = await fs.stat(subpath);

        if (stats.isDirectory())
            dirs.push(item);

        if (subpath.indexOf('-test.js') > -1)
            files.push(item);
    }

    var dirItems = await fs.readdir(dirPath);

    await Promise.all(dirItems.map(processDirItem));

    dirs.sort();
    files.sort();

    return { dirs, files };
}
