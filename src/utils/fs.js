import fs from 'fs';
import Promise from 'pinkie';
import promisify from 'pify';

export var stat = function (path) {
    return new Promise(resolve => {
        fs.stat(path, (err, stats) => {
            resolve(stats || null);
        });
    });
};

export var readdir      = promisify(fs.readdir, Promise);
export var readfile     = promisify(fs.readFile, Promise);
export var readfileSync = fs.readFileSync;

