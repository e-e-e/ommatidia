import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import chalk from 'chalk';

const fsStat = Promise.promisify(fs.stat);
const fsUnlink = Promise.promisify(fs.unlink);

const save = (from, to) => (
  // check if file already exists - if so rename file.
  new Promise((resolve, reject) => {
    const input = fs.createReadStream(from);
    const output = fs.createWriteStream(to);
    input.on('error', reject);
    output.on('error', reject);
    output.on('close', resolve);
    input.pipe(output);
  })
);

const processFile = (file) => {
  const originalFilepath = path.join(file.original_path, file.original_name);
  // where is the file being saved?
  if (!file.updated) {
    // is a new file
    console.log(chalk.bold('Creating new public file for:'), originalFilepath);
    save();
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
  return file;
};

export default function transferFiles(filesModel) {
  return filesModel.selectDirty()
    .then(files => Promise.all(
      files.map(file => filesModel.facetedPath(file.related_om)),
    ))
    .then(res => res.forEach(e => console.log(e)))
    .catch(console.error);
}
