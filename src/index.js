import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import { template } from 'lodash';
import chalk from 'chalk';

import Knex from 'knex';
import Thesaurus from './db/models/thesaurus';
import { generateOmFilename, isOmmatidiaFile } from './utils';

const fsStat = Promise.promisify(fs.stat);
const fsReadFile = Promise.promisify(fs.readFile);
const fsWriteFile = Promise.promisify(fs.writeFile);

export default class Ommatidia {
  constructor(config) {
    console.log(config);
    // establishdata base connection here using
    this.knex = Knex({
      client: 'pg',
      connection: config.database || 'postgres://localhost/ommatidia',
      migrations: {
        directory: path.join(__dirname, './db/migrations'),
      },
      seeds: {
        directory: path.join(__dirname, './db/seeds/development'),
      },
    });
    // should test to see if one exists before trying to load it.
    this.thesaurusFile = config.thesaurus;
    this.thesaurus = new Thesaurus(this.knex);
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

  status() {
    // what stats do we want to present.
    // is database initialised?
    // How many files are tracked
    // how many terms in the theasurus
    // where is the base directory.
    //
    return this.thesaurus.count().then(count => console.log('term count:', count));
  }

  initialiseDatabase() {
    const filename = path.join(process.cwd(), this.thesaurusFile);
    return this.knex.migrate.rollback()
      .then(() => this.knex.migrate.latest())
      .then(() => this.thesaurus.build(filename));
  }

}
