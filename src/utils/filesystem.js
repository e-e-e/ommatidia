import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import Promise from 'bluebird';

const fsStat = Promise.promisify(fs.stat);
const fsMkDir = Promise.promisify(fs.mkdir);

export const relativeToCwd = filepath => path.relative(process.cwd(), filepath);

export function hashFile(file) {
  const promise = new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(file);
    stream.on('data', data => hash.update(data, 'utf8'));
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    stream.on('error', reject);
  });
  return promise;
}

export const makeDirIfNotExistant = async dir =>
  fsStat(dir)
    .then(stat => (stat.isDirectory() ? true : fsMkDir(dir)))
    .catch((error) => {
      if (error.code === 'ENOENT') return fsMkDir(dir);
      throw error;
    });

export const incrementFileName = (filename) => {
  const pathObj = path.parse(filename);
  const match = pathObj.name.match(/-(\d+)$/);
  return (!match)
    ? `${pathObj.name}-1${pathObj.ext}`
    : `${pathObj.name.substring(0, match.index)}-${parseInt(match[1], 10) + 1}${pathObj.ext}`;
};

export const renameFileIfItExists = async (destination, file) =>
  fsStat(path.join(destination, file))
    .then((stat) => {
      if (stat.isFile()) {
        return renameFileIfItExists(destination, incrementFileName(file));
      }
      return file;
    })
    .catch((error) => {
      if (error.code === 'ENOENT') return file;
      throw error;
    });
