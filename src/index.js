import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import _ from 'lodash';
import chalk from 'chalk';

import Knex from 'knex';
import Thesaurus from './db/models/thesaurus';
import { OmmatidiaMetadata, Files, TrackedFiles } from './db/models/ommatidia';
import { generateOmFilename, isOmmatidiaFile, loadOmmatidiaFile } from './utils';
import walk from './walk';

const fsStat = Promise.promisify(fs.stat);
const fsReadFile = Promise.promisify(fs.readFile);
const fsWriteFile = Promise.promisify(fs.writeFile);

export default class Ommatidia {
  constructor(config) {
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
    this.db = {
      thesaurus: new Thesaurus(this.knex),
      ommatidiaFiles: new OmmatidiaMetadata(this.knex),
      trackedFiles: new TrackedFiles(this.knex),
      files: new Files(this.knex),
    };
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
    return this.db.thesaurus.count().then(count => console.log('term count:', count));
  }

  initialiseDatabase() {
    const filename = path.join(process.cwd(), this.thesaurusFile);
    return this.knex.migrate.rollback()
      .then(() => this.knex.migrate.latest())
      .then(() => this.db.thesaurus.build(filename));
  }

  processOmDirectory = async (dir, folders, omFiles, notOmFiles, baseOm, parentId) => {
    const processOmFile = (baseOmId, include, sourceFileId) =>
      async ({ omFile, relatedFile }) => {
        let parent = baseOmId;
        const omFilepath = path.join(dir, omFile);
        const specificOmData = loadOmmatidiaFile(omFilepath);
        if (include) {
          const otherMetadata = include[relatedFile];
          if (otherMetadata && !_.isEmpty(otherMetadata)) {
            parent = await this.db.ommatidiaMetadata.add(otherMetadata, sourceFileId, baseOmId);
          }
        }
        const omSourceFileId = await this.db.trackedFiles.add(omFilepath);
        const omId = await this.db.ommatidiaMetadata.add(specificOmData, omSourceFileId, parent);
        return this.db.files.add(path.join(dir, relatedFile), omId);
      };

    const processInclude = (baseOmId, sourceFileId) =>
      async ({ filepath, metadata }) => {
        let metaId = baseOmId;
        if (!_.isEmpty(metadata)) {
          metaId = await this.db.ommatidiaMetadata.add(metadata, sourceFileId, baseOmId);
        }
        await this.db.files.add(filepath, metaId);
      };

    let baseOmId = parentId;

    if (baseOm) {
      const sourceFileId = await this.db.trackedFiles.add(baseOm.baseOmFilepath);
      baseOmId = await this.db.ommatidiaMetadata.add(baseOm.omData, sourceFileId, parentId);

      await Promise.each(omFiles, processOmFile(baseOmId, baseOm.include, sourceFileId));

      if (baseOm.include) {
        let filesStillToInclude = _.omit(baseOm.include, omFiles.map(om => om.relatedFile));
        filesStillToInclude = _.map(filesStillToInclude,
          (v, k) => ({ filepath: path.join(dir, k), metadata: v }));
        await Promise.each(filesStillToInclude, processInclude(baseOmId, sourceFileId));
      }
    } else {
      // just process omFiles
      await Promise.each(omFiles, processOmFile(dir, baseOmId));
    }
    return baseOmId;
  }

  build(dir) {
    return walk(dir, this.processOmDirectory);
  }

}
