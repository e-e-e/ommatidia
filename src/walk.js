import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import minimatch from 'minimatch';
import chalk from 'chalk';

import {
  isOmmatidiaFile,
  isBaseOmmatidiaFile,
  relatedOmmatidiaFile,
  loadOmmatidiaFile,
} from './utils';

const readdir = Promise.promisify(fs.readdir);
const stat = Promise.promisify(fs.stat);

const reduceFileArrayToMetadataDictionary = metadata => (mapped, file) => {
  const meta = metadata || {};
  if (mapped[file]) {
    mapped[file] = { ...mapped[file], ...meta };
  } else {
    mapped[file] = meta;
  }
  return mapped;
};

function filesToInclude(omData, otherFiles) {
  if (typeof omData.include === 'string') {
    // console.log('include as a sting', omData.include);
    const patternFilter = minimatch.filter(omData.include);
    return otherFiles
      .filter(patternFilter)
      .reduce(reduceFileArrayToMetadataDictionary(), {});
  } else if (Array.isArray(omData.include)) {
    // console.log('include as an array', omData.include);
    return omData.include.reduce((mappedFiles, include) => {
      const metadata = (typeof include === 'string') ? {} : include.meta;
      const pattern = minimatch.filter((typeof include === 'string') ? include : include.file);
      return otherFiles
        .filter(pattern)
        .reduce(reduceFileArrayToMetadataDictionary(metadata), mappedFiles);
    }, {});
  }
  return null;
}

const defaultKindStructure = () => ({ folders: [], omFiles: [], notOmFiles: [], baseOm: '' });

const sortFilesIntoKind = ({ folders, omFiles, notOmFiles, baseOm }, file, index, files) => {
  if (file.stat.isDirectory()) {
    folders.push(file.name);
  } else if (file.stat.isFile() && isOmmatidiaFile(file.name)) {
    if (isBaseOmmatidiaFile(file.name)) {
      baseOm = file.name; // eslint-disable-line
    } else {
      const relatedFile = relatedOmmatidiaFile(file.name);
      if (files.find(f => f.name === relatedFile)) {
        omFiles.push({ relatedFile, omFile: file.name });
      } else {
        console.log(chalk.yellow('.om file does not match any file in directory:'));
        console.log(file.name, relatedFile);
      }
    }
  } else if (file.stat.isFile()) {
    notOmFiles.push(file.name);
  }
  return { folders, omFiles, notOmFiles, baseOm };
};

async function getFolderContents(dir) {
  try {
    let files = await readdir(dir);
    files = await Promise.map(files, file => (
      stat(path.join(dir, file))
      .then(s => ({ name: file, stat: s }))
    ));
    const folderContent = files.reduce(sortFilesIntoKind, defaultKindStructure());
    if (folderContent.baseOm) {
      const baseOmFilepath = path.join(dir, folderContent.baseOm);
      const omData = loadOmmatidiaFile(baseOmFilepath);
      const include = filesToInclude(omData, folderContent.notOmFiles);
      folderContent.baseOm = {
        baseOmFilepath,
        omData,
        include,
      };
    }
    return folderContent;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export default async function walkDirectory(dir, fn, data) {
  console.log(chalk.bold('Crawling:'), dir);
  const folderContents = await getFolderContents(dir);
  const returnData = await fn(dir, folderContents, data);
  // recursively crawl directories
  return Promise.mapSeries(
    folderContents.folders,
    folder => walkDirectory(path.join(dir, folder), fn, returnData),
  );
}
