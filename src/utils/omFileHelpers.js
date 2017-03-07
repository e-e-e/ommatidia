import fs from 'fs';
import yaml from 'js-yaml';

export const generateOmFilename = filename => `*.${filename}.om`;

export const isOmmatidiaFile = filename => /^\*.*\.om$/.test(filename);

export const isBaseOmmatidiaFile = filename => (isOmmatidiaFile(filename) && filename.length === 4);

export const relatedOmmatidiaFile = (filename) => {
  const match = filename.match(/^\*\.(.*)\.om$/);
  return (match && match.length > 1) ? match[1] : null;
};

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
