#!/usr/bin/env node
import {} from 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import yaml from 'js-yaml';


const readdir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);
const src = '../TestDirectories';

function isOmmatidiaFile(filename) {
  return /^\*.*\.om$/.test(filename);
}

function isBaseOmmatidiaFile(filename) {
  return isOmmatidiaFile(filename) && filename.length === 4;
}

function relatedOmmatidiaFile(filename) {
  const match = filename.match(/^\*(.*)\.om$/);
  return (match && match.length > 1) ? match[1] : null;
}

function loadOmmatidiaFile(filename) {
  const frontmatter = /^(-{3,}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3,})?(?:\n|\r)+([\w\W]*)*/;
  const contents = fs.readFileSync(filename, 'utf8');
  if (contents instanceof Error) throw contents;
  const results = frontmatter.exec(contents);
  const meta = (results[2]) ? yaml.safeLoad(results[2]) : {};
  let description = results[3];
  if (typeof description === 'string') description = description.trim();
  return { ...meta, description };
}

function crawlDirectory(dir) {
  return readdir(dir)
    .map(file => stat(path.join(dir, file)).then(s => ({ name: file, stat: s })))
    .then((files) => {
      const folders = [];
      const oms = [];
      let baseOm;
      files.forEach((file) => {
        if (file.stat.isDirectory()) {
          folders.push(path.join(dir, file.name));
        } else if (file.stat.isFile() && isOmmatidiaFile(file.name)) {
          if (isBaseOmmatidiaFile(file.name)) {
            baseOm = path.join(dir, file.name);
          } else {
            const relatedFile = relatedOmmatidiaFile(file.name);
            if (files.find(f => f.name === relatedFile)) {
              oms.push(path.join(dir, file.name));
            } else {
              console.warn('.om file does not match any file in directory:');
              console.warn(path.join(dir, file.name));
            }
          }
        }
      });
      const omData = (baseOm) ? loadOmmatidiaFile(baseOm) : {};
      if (omData.includes === 'all') {
        // process all files in directory giving precedence to those with their own .om file.
        // if they have there own data merge with data from *.om.
      } else if (Array.isArray(omData.includes)) {
        // add all files included in *.om file
        // if they have there own data merge with data from *.om.
      }
      // process remaining om files
      // crawl directories, passing down data from *.om file.
    });
}

crawlDirectory(src);
