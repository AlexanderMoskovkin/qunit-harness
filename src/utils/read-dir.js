import path from 'path';
import * as fs from './fs';

export default async function (dirPath) {
    var result = {
        dirs:  [],
        files: []
    };

    async function processDirItem (item) {
        var subpath = path.join(dirPath, item);

        var stats = await fs.stat(subpath);

        if (stats.isDirectory())
            result.dirs.push(item);

        if (path.extname(subpath) === '.js')
            result.files.push(item);
    }

    var dirItems = await fs.readdir(dirPath);

    await Promise.all(dirItems.map(processDirItem));

    result.dirs.sort();
    result.files.sort();

    return result;
}
