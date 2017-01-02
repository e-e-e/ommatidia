import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import { template } from 'lodash';
import chalk from 'chalk';

import { generateOmFilename, isOmmatidiaFile } from './utils';

const fsStat = Promise.promisify(fs.stat);
const fsReadFile = Promise.promisify(fs.readFile);
const fsWriteFile = Promise.promisify(fs.writeFile);

export default class Ommatidia {
  constructor(config) {
    console.log(config);
  }

  static makeOmFile = (file) => {
    const templateFile = path.join(__dirname, 'stubs/om.yml');
    const filepath = (file) ? path.join(process.cwd(), file) : process.cwd();
    let promise = null;

    if (file) {
      if (file !== path.basename(file)) {
        return Promise.reject(new Error(`${file} is not within current directory om file.`));
      }
      if (isOmmatidiaFile(file)) {
        return Promise.reject(new Error(`${file} is an om file.`));
      }
      console.log(`Attempting to make om file for ${file}.`);
      promise = fsStat(filepath)
        .then((stat) => {
          if (!stat.isFile()) {
            const message = `${filepath} is not a file.`;
            console.log(chalk.yellow(message));
            throw new Error(message);
          }
          return null;
        });
    }
    return Promise.resolve(promise)
      .then(() => fsReadFile(templateFile))
      .then((templateString) => {
        const fn = (file) ? generateOmFilename(file) : '*.om';
        const title = (file)
          ? path.basename(file, path.extname(file))
          : path.basename(process.cwd());
        const newOmFile = path.join(process.cwd(), fn);
        const data = template(templateString)({ title });
        console.log(`Making new om file ${newOmFile}, with default title: ${chalk.green(title)}.`);
        return fsWriteFile(newOmFile, data, { flag: 'wx' });
      });
  }

}
