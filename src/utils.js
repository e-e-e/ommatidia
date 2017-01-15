import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';
import Promise from 'bluebird';

export const relativeToCwd = filepath => path.relative(process.cwd(), filepath);

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
    console.warn('unable to load Om file:', filename);
    console.warn(e, e.stack);
    return null;
  }
}
