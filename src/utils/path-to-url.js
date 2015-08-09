import path from 'path';

export default function (filePath) {
    return path.normalize(filePath).replace(/\\/g, '/');
}
