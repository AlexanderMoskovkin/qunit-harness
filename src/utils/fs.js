import fs from 'fs';
import Promise from 'promise';

export var stat = function (path) {
    return new Promise(resolve => {
        fs.stat(path, (err, stats) => {
            resolve(stats || null);
        });
    });
};

export var readdir      = Promise.denodeify(fs.readdir);
export var readfile     = Promise.denodeify(fs.readFile);
export var readfileSync = fs.readFileSync;

