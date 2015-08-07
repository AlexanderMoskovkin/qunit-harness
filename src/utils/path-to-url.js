import path from 'path';

export default function (path, basePath) {
    return path.substr(basePath.length).replace(/\\/g, '/');
}
