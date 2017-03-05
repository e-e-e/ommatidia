import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import mmm from 'mmmagic';
import mime from 'mime-types';
import Promise from 'bluebird';

const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
const detectFile = Promise.promisify(magic.detectFile, { context: magic });

export const relativeToCwd = filepath => path.relative(process.cwd(), filepath);

export const isOmmatidiaFile = filename => /^\*.*\.om$/.test(filename);

export const isBaseOmmatidiaFile = filename => (isOmmatidiaFile(filename) && filename.length === 4);

export const relatedOmmatidiaFile = (filename) => {
  const match = filename.match(/^\*\.(.*)\.om$/);
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

export function mimetype(file) {
  return detectFile(file).catch((err) => {
    console.warn(err);
    return mime.lookup(file);
  });
}

export function loadOmmatidiaFile(filename) {
  try {
    const frontmatter = /^(-{3,}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3,})([\w\W]*)*/;
    const contents = fs.readFileSync(filename, 'utf8');
    if (contents instanceof Error) throw contents;
    const results = frontmatter.exec(contents);
    const meta = (results[2]) ? yaml.safeLoad(results[2]) : {};
    let description = results[3];
    if (typeof description === 'string') description = description.trim();
    return { include: meta.include, meta, description };
  } catch (e) {
    console.warn('Unable to load Om file:', filename);
    console.warn(e, e.stack);
    return null;
  }
}
