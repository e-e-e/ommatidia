import fs from 'fs';
import crypto from 'crypto';

import Promise from 'bluebird';

export const isOmmatidiaFile = filename => /^\*.*\.om$/.test(filename);

export const isBaseOmmatidiaFile = filename => (isOmmatidiaFile(filename) && filename.length === 4);

export const relatedOmmatidiaFile = (filename) => {
  const match = filename.match(/^\*(.*)\.om$/);
  return (match && match.length > 1) ? match[1] : null;
};

export const generateOmFilename = filename => `*.${filename}.om`;

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
