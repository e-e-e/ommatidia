import path from 'path';
import chalk from 'chalk';
import { hashFile, relativeToCwd } from '../../utils';

export class TrackedFiles {
  constructor(knex) {
    this.trackedFiles = () => knex('tracked_files');
    this.ommatidia = () => knex('ommatidia');
  }

  static async mapData(src) {
    return {
      md5: await hashFile(src),
      filename: path.basename(src),
      path: path.dirname(src),
    };
  }

  async add(filepath) {
    const file = await TrackedFiles.mapData(filepath);
    console.log(chalk.gray(chalk.bold('Tracking file:'), relativeToCwd(filepath)));
    return this.trackedFiles()
      .insert(file)
      .returning('tracked_id')
      .then(res => res[0])
      .catch((error) => {
        const re = /duplicate key value violates unique constraint "tracked_files_md5_unique"/;
        if (re.test(error.message)) {
          console.log(chalk.yellow('FILE NOT TRACKED: is identical to another file already included.'));
        } else {
          throw error;
        }
      });
  }

  all = () => this.trackedFiles().select();

  get = hash => this.trackedFiles().select().where({ md5: hash });

  delete = fileId => this.trackedFiles().where({ file_id: fileId }).del();

  effected = fileId => this.ommatidia().select().where({ source_file_id: fileId });
}

export class OmmatidiaMetadata {
  constructor(knex) {
    this.knex = knex;
    this.ommatidia = () => knex('ommatidia');
    this.files = () => knex('files');
  }

  add(omData, srcFileId, parentId, isOmBase = false) {
    const om = {
      source_file_id: srcFileId,
      parent: parentId || null,
      title: omData.title,
      description: omData.description,
      metadata: omData.meta,
      om_base: isOmBase,
    };
    return this.ommatidia().insert(om).returning('om_id').then(res => res[0]);
  }

  addSubjects(omId, facet, subjects) {
    const data = subjects.map(subject => ({ om_id: omId, term_id: subject.term_id }));
    return this.knex(`ommatidia_${facet.toLowerCase()}`).insert(data);
  }

  all = () => this.ommatidia().select();

  get = id => this.ommatidia().where({ om_id: id }).select();

  getFull = id => this.knex.raw(`
    WITH RECURSIVE all_metadata(metadata, description, parent, om_id, depth) AS (
        SELECT o.metadata, o.description, o.parent, o.om_id, 1 
        FROM ommatidia o 
        WHERE o.om_id = ?
      UNION ALL
        SELECT o.metadata, o.description, o.parent, o.om_id, depth+1
        FROM ommatidia o, all_metadata am
        WHERE o.om_id = am.parent
    )
    SELECT * FROM all_metadata ORDER BY depth DESC;
  `, [id]);

  delete = id => this.ommatidia().where({ om_id: id }).del();

  relatedFiles = id => this.files().select().where({ related_om: id })
}

export class Files {
  constructor(knex) {
    this.files = () => knex('files');
  }

  static async mapData(src, omId) {
    return {
      md5: await hashFile(src),
      original_name: path.basename(src),
      original_path: path.dirname(src),
      related_om: omId,
    };
  }

  async add(filepath, omId) {
    const file = await Files.mapData(filepath, omId);
    console.log(chalk.gray(chalk.bold('Adding file:'), relativeToCwd(filepath)));
    return this.files()
      .insert(file)
      .returning('file_id')
      .catch((error) => {
        const re = /duplicate key value violates unique constraint "files_md5_unique"/;
        if (re.test(error.message)) {
          console.log(chalk.yellow('FILE NOT ADDED: is identical to another file already included.'));
        } else {
          throw error;
        }
      });
  }
}
