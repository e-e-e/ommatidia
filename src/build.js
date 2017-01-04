import {} from 'dotenv/config';
import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import yaml from 'js-yaml';
import minimatch from 'minimatch';
import chalk from 'chalk';
import _ from 'lodash';

import { ommatidia, trackedFiles, ommatidiaFiles } from './db/models/ommatidia';

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
  return { include: meta.include, meta, description };
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
        console.log(chalk.orange('.om file does not match any file in directory:'));
        console.log(file.name);
      }
    }
  } else if (file.stat.isFile()) {
    notOmFiles.push(file.name);
  }
  return { folders, omFiles, notOmFiles, baseOm };
};

const reduceFileArrayToMetadataDictionary = metadata => (mapped, file) => {
  const meta = metadata || {};
  if (mapped[file]) {
    mapped[file] = { ...mapped[file], ...meta };
  } else {
    mapped[file] = meta;
  }
  return mapped;
};

async function getFolderContents(dir) {
  try {
    let files = await readdir(dir);
    files = await Promise.map(files, file => (
      stat(path.join(dir, file))
      .then(s => ({ name: file, stat: s }))
    ));
    return files.reduce(sortFilesIntoKind, defaultKindStructure());
  } catch (e) {
    console.error(e);
    return null;
  }
}

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

const processOmFile = (dir, baseOmId, include, sourceFileId) =>
  async ({ omFile, relatedFile }) => {
    let parent = baseOmId;
    const omFilepath = path.join(dir, omFile);
    const specificOmData = loadOmmatidiaFile(omFilepath);
    if (include) {
      const otherMetadata = include[relatedFile];
      if (otherMetadata && !_.isEmpty(otherMetadata)) {
        parent = await ommatidia.add(otherMetadata, sourceFileId, baseOmId);
      }
    }
    const omSourceFileId = await trackedFiles.add(omFilepath);
    const omId = await ommatidia.add(specificOmData, omSourceFileId, parent);
    return ommatidiaFiles.add(path.join(dir, relatedFile), omId);
  };

const processInclude = (baseOmId, sourceFileId) =>
  async ({ filepath, metadata }) => {
    let metaId = baseOmId;
    if (!_.isEmpty(metadata)) {
      metaId = await ommatidia.add(metadata, sourceFileId, baseOmId);
    }
    await ommatidiaFiles.add(filepath, metaId);
  };

async function crawlDirectory(dir, parentId) {
  console.log(chalk.bold('Crawling:'), dir);
  const { folders, omFiles, notOmFiles, baseOm } = await getFolderContents(dir);
  let baseOmId = parentId;

  if (baseOm) {
    const baseOmFilepath = path.join(dir, baseOm);
    const omData = loadOmmatidiaFile(baseOmFilepath);
    const include = filesToInclude(omData, notOmFiles);

    const sourceFileId = await trackedFiles.add(baseOmFilepath);
    baseOmId = await ommatidia.add(omData, sourceFileId, parentId);

    await Promise.each(omFiles, processOmFile(dir, baseOmId, include, sourceFileId));

    if (include) {
      let filesStillToInclude = _.omit(include, omFiles.map(om => om.relatedFile));
      filesStillToInclude = _.map(filesStillToInclude,
        (v, k) => ({ filepath: path.join(dir, k), metadata: v }));
      await Promise.each(filesStillToInclude, processInclude(baseOmId, sourceFileId));
    }
  } else {
    // just process omFiles
    await Promise.each(omFiles, processOmFile(dir, baseOmId));
  }
  // recursively crawl directories
  return Promise.mapSeries(folders, folder => crawlDirectory(path.join(dir, folder), baseOmId));
}

async function begin() {
  await crawlDirectory(src);
  console.log('done');
  return null;
}

begin().then(() => process.exit());
// processDirectory(src);
// .then(() => crawlDirectory(path.join(src, 'alibrary')))
// .then(() => crawlDirectory(path.join(src, 'Success/26 ideal erasures')))
// .then(() => crawlDirectory(path.join(src, 'Success/Success2016')));
