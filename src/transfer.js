import path from 'path';
import chalk from 'chalk';

import { makeDirIfNotExistant, renameFileIfItExists } from './utils/filesystem';
import { isImage } from './utils/filetypes';
import imageTranscoder from './transcoders/images';
import identityTranscoder from './transcoders/identity';


const transcodeSuccess = (results) => {
  console.log('SUCCESS', results);
};

const transcodeError = (error) => {
  console.error('something went wrong with transcoding');
  console.error(error);
};

const transcode = (file, from, to) => {
  let transcoder;
  if (isImage(file)) {
    transcoder = imageTranscoder(from, to);
  } else {
    transcoder = identityTranscoder(from, to);
  }
  return transcoder
    .then(transcodeSuccess)
    .catch(transcodeError);
};

const processFile = (filesModel, destination) => async (file) => {
  console.log(chalk.bold('processing:', file.original_name));
  const facetedDir = await filesModel.facetedPath(file.related_om);
  const originalFilepath = path.join(file.original_path, file.original_name);
  const newDirectory = path.join(destination, facetedDir);
  await makeDirIfNotExistant(newDirectory);
  if (!file.updated && file.name === null && file.path === null) {
    // is a new file
    console.log(chalk.bold('Creating new public file for:'), originalFilepath);
    const newFileName = await renameFileIfItExists(newDirectory, file.original_name);

    console.log(chalk.bold('Creating new public file At:'), path.join(facetedDir, newFileName));
    const newFilePath = path.join(newDirectory, newFileName);
    await transcode(file, originalFilepath, newFilePath);
    await filesModel.updateFilepath(file.file_id, facetedDir, newFileName);
  } else if (file.name !== null && file.path !== null) {
    // original file contents have change
    const filepath = path.join(file.path, file.name);
    console.log(chalk.bold('Original file has been updated:'), originalFilepath);
    // is the new location the same as the old?
    // if not remove old file.
    console.log(chalk.bold('Updating public file:'), filepath);
    // delete the original
  } else {
    console.log(chalk.red('There is something wrong with file:', file.file_id));
  }
};

export default function transferFiles(filesModel, destination) {
  return makeDirIfNotExistant(destination)
    .then(() => filesModel.selectDirty())
    .mapSeries(processFile(filesModel, destination))
    .catch(console.error);
}
