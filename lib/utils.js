import fs from 'fs';
import crypto from 'crypto';

import Promise from 'bluebird';

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
