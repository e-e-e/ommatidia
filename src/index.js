import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import _ from 'lodash';
import chalk from 'chalk';

import Knex from 'knex';
import Thesaurus from './db/models/thesaurus';
import { OmmatidiaMetadata, Files, TrackedFiles } from './db/models/ommatidia';
import { generateOmFilename, isOmmatidiaFile } from './utils';
import walk from './walk';
import processOmDirectory from './process';

const fsStat = Promise.promisify(fs.stat);
const fsReadFile = Promise.promisify(fs.readFile);
const fsWriteFile = Promise.promisify(fs.writeFile);

export default class Ommatidia {
  constructor(config) {
    // establishdata base connection here using
    console.log(config);
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
    this.db = {
      thesaurus: new Thesaurus(this.knex),
      ommatidiaMetadata: new OmmatidiaMetadata(this.knex),
      trackedFiles: new TrackedFiles(this.knex),
      files: new Files(this.knex),
    };
    this.baseDir = process.cwd();
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
        const data = _.template(templateString)({ title });
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
    return this.db.thesaurus.log();
    // return this.db.thesaurus.count().then(count => console.log('term count:', count))
    //   .then(() => this.db.thesaurus.allTermsByFacet('space'))
    //   .then(console.log)
    //   .then(() => this.db.thesaurus.allTermsByFacet('matter'))
    //   .then(console.log)
    //   .then(() => this.db.thesaurus.allTermsByFacet('space'))
    //   .then(console.log);
  }

  initialiseDatabase() {
    const filename = path.join(process.cwd(), this.thesaurusFile);
    return this.knex.migrate.rollback()
      .then(() => this.knex.migrate.latest())
      .then(() => this.db.thesaurus.build(filename))
      .then(() => this.db.thesaurus.refreshView());
  }

  build(options) {
    console.log(options);
    return walk(this.baseDir, processOmDirectory(this.db));
  }

}
