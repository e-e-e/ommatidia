import path from 'path';
import chalk from 'chalk';
import knex from '../knex';
import { hashFile } from '../../lib/utils';


const TrackedFiles = () => knex('tracked_files');
const Files = () => knex('files');
const Ommatidia = () => knex('ommatidia');

async function mapFileData(src, omId) {
  return {
    md5: await hashFile(src),
    name: path.basename(src),
    path: path.dirname(src),
    original_name: path.basename(src),
    original_path: path.dirname(src),
    related_om: omId,
  };
}

async function mapTrackedFileData(src) {
  return {
    md5: await hashFile(src),
    filename: path.basename(src),
    path: path.dirname(src),
  };
}

export const trackedFiles = {
  add: async (filepath) => {
    const file = await mapTrackedFileData(filepath);
    console.log(chalk.gray(chalk.bold('Tracking file:'), filepath));
    return TrackedFiles().insert(file).returning('tracked_id').then(res => res[0]);
  },
  all: () => trackedFiles().select(),
  get: hash => TrackedFiles().select().where({ md5: hash }),
  delete: fileId => TrackedFiles().where({ file_id: fileId }).del(),
  effected: fileId => Ommatidia().select().where({ source_file_id: fileId }),
};

export const ommatidia = {
  add: (omData, srcFileId, parentId) => {
    const om = {
      source_file_id: srcFileId,
      parent: parentId || null,
      title: omData.title,
      description: omData.description,
      metadata: omData.meta,
    };
    return Ommatidia().insert(om).returning('om_id').then(res => res[0]);
  },
  all: () => Ommatidia().select(),
  get: id => Ommatidia().where({ om_id: id }).select(),
  getFull: id => knex.raw(`
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
  `, [id]),
  delete: id => Ommatidia().where({ om_id: id }).del(),
  relatedFiles: id => Files.select().where({ related_om: id }),
};

export const ommatidiaFiles = {
  add: async (filepath, omId) => {
    const file = await mapFileData(filepath, omId);
    console.log(chalk.gray(chalk.bold('Adding file:'), filepath));
    return Files().insert(file).returning('file_id');
  },
};
