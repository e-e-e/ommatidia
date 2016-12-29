#!/usr/bin/env node
import {} from 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import yaml from 'js-yaml';
import minimatch from 'minimatch';

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
  const frontmatter = /^(-{3,}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3,})([\w\W]*)*/;
  const contents = fs.readFileSync(filename, 'utf8');
  if (contents instanceof Error) throw contents;
  const results = frontmatter.exec(contents);
  const meta = (results[2]) ? yaml.safeLoad(results[2]) : {};
  let description = results[3];
  if (typeof description === 'string') description = description.trim();
  return { ...meta, description };
}

const getEmptyKindStructure = () => ({ folders: [], omFiles: [], notOmFiles: [], baseOm: '' });

const sortFilesIntoKind = dir => ({ folders, omFiles, notOmFiles, baseOm }, file, index, files) => {
  if (file.stat.isDirectory()) {
    folders.push(path.join(dir, file.name));
  } else if (file.stat.isFile() && isOmmatidiaFile(file.name)) {
    if (isBaseOmmatidiaFile(file.name)) {
      baseOm = path.join(dir, file.name);
    } else {
      const relatedFile = relatedOmmatidiaFile(file.name);
      if (files.find(f => f.name === relatedFile)) {
        omFiles.push({ relatedFile, omFile: path.join(dir, file.name) });
      } else {
        console.warn('.om file does not match any file in directory:');
        console.warn(path.join(dir, file.name));
      }
    }
  } else if (file.stat.isFile()) {
    notOmFiles.push(file.name);
  }
  return { folders, omFiles, notOmFiles, baseOm };
};

function crawlDirectory(dir) {
  console.log('\n', '\n', 'crawl:', dir, '\n', '\n');
  return readdir(dir)
    .map(file => stat(path.join(dir, file)).then(s => ({ name: file, stat: s })))
    .then(files => files.reduce(sortFilesIntoKind(dir), getEmptyKindStructure()))
    .then(({ folders, omFiles, notOmFiles, baseOm }) => {
      // const folders = [];
      // const omFiles = [];
      // const notOmFiles = [];
      // let baseOm;

      // files.forEach((file) => {
      //   if (file.stat.isDirectory()) {
      //     folders.push(path.join(dir, file.name));
      //   } else if (file.stat.isFile() && isOmmatidiaFile(file.name)) {
      //     if (isBaseOmmatidiaFile(file.name)) {
      //       baseOm = path.join(dir, file.name);
      //     } else {
      //       const relatedFile = relatedOmmatidiaFile(file.name);
      //       if (files.find(f => f.name === relatedFile)) {
      //         omFiles.push({ relatedFile, omFile: path.join(dir, file.name) });
      //       } else {
      //         console.warn('.om file does not match any file in directory:');
      //         console.warn(path.join(dir, file.name));
      //       }
      //     }
      //   } else if (file.stat.isFile()) {
      //     notOmFiles.push(file.name);
      //   }
      // });
      console.log('load base om');
      const omData = (baseOm) ? loadOmmatidiaFile(baseOm) : {};

      console.log('This is where we would add main meta data :');
      console.log(omData);
      console.log('lets say it has an id of 2.');
      // add metadata to database -> get id.
      let filesToInclude;
      if (typeof omData.include === 'string') {
        console.log('include as a sting', omData.include);
        const patternFilter = minimatch.filter(omData.include);
        filesToInclude = notOmFiles.filter(patternFilter);
      } else if (Array.isArray(omData.include)) {
        console.log('include as an array', omData.include);
        filesToInclude = omData.include.reduce((mappedFiles, data) => {
          const pattern = (typeof data === 'string') ? data : data.file;
          const matchedFiles = notOmFiles.filter(minimatch.filter(pattern));
          return matchedFiles.reduce((mapped, file) => {
            const meta = data.meta ? data.meta : {};
            if (mapped[file]) mapped[file] = { ...mapped[file], ...meta };
            else mapped[file] = meta;
            return mapped;
          }, mappedFiles);
        }, {});
      }
      console.log(filesToInclude);
      // process remaining om files
      console.log('process oms', omFiles);
      omFiles.forEach((pair) => {
        console.log('pair', pair);
        const omData = loadOmmatidiaFile(pair.omFile);
        console.log('this is where we would add the metadata of the file:');
        console.log(pair.relatedFile, pair.omFile);
        console.log('data:');
        console.log(omData);
      });
      // crawl directories, passing down data from *.om file.
      return Promise.mapSeries(folders, folder => crawlDirectory(path.join(src, folder)));
    });
}

crawlDirectory(src);
// .then(() => crawlDirectory(path.join(src, 'alibrary')))
// .then(() => crawlDirectory(path.join(src, 'Success/26 ideal erasures')))
// .then(() => crawlDirectory(path.join(src, 'Success/Success2016')));
