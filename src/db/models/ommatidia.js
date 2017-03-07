import path from 'path';
import _ from 'lodash';
import Promise from 'bluebird';
import chalk from 'chalk';
import mimetype from '../../utils/mimetype';
import { relativeToCwd, hashFile } from '../../utils/filesystem';
import { FACETS } from '../../consts/index';

const makeArrayIfNot = v => ((Array.isArray(v)) ? v : [v]);

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
    const relativeFilePath = relativeToCwd(filepath);
    const file = await TrackedFiles.mapData(relativeFilePath);
    console.log(chalk.gray(chalk.bold('Tracking file:'), relativeFilePath));
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
    this.ommatidia_reduced = () => knex('om_reduced');
    this.files = () => knex('files');
  }

  select(id) {
    if (!id) return this.ommatidia_reduced().select();
    return this.ommatidia_reduced().where({ om_id: id }).select();
  }

  selectRoots() {
    return this.ommatidia_reduced().where({ parent: null, om_base: true }).select();
  }

  selectAllBases() {
    return this.ommatidia_reduced().where({ om_base: true }).select();
  }

  selectChildrenOf(id, base) {
    const where = { parent: id };
    if (typeof base === 'boolean') where.om_base = base;
    return this.ommatidia_reduced().where(where).select();
  }

  refresh() {
    return this.knex.raw('REFRESH MATERIALIZED VIEW om_reduced WITH DATA;');
  }

  add(omData, srcFileId, parentId, isOmBase = false) {
    const om = {
      source_file_id: srcFileId,
      parent: parentId || null,
      title: omData.meta.title,
      description: omData.description,
      metadata: _.omit(omData.meta, ['title', 'include', 'subjects']),
      om_base: isOmBase,
    };
    return this.ommatidia().insert(om).returning('om_id').then(res => res[0]);
  }

  addSubjects(omId, facet, subjects) {
    const data = subjects.map((subject, index) => ({ om_id: omId, term_id: subject.term_id, ordinal: index }));
    return this.knex(`ommatidia_${facet.toLowerCase()}`).insert(data);
  }

  all = () => this.ommatidia().select();

  get = id => this.ommatidia().where({ om_id: id }).select();

  // getFull = id => this.knex.raw(`
  //   WITH RECURSIVE all_metadata(metadata, description, parent, om_id, depth) AS (
  //       SELECT o.metadata, o.description, o.parent, o.om_id, 1
  //       FROM ommatidia o
  //       WHERE o.om_id = ?
  //     UNION ALL
  //       SELECT o.metadata, o.description, o.parent, o.om_id, depth+1
  //       FROM ommatidia o, all_metadata am
  //       WHERE o.om_id = am.parent
  //   )
  //   SELECT * FROM all_metadata ORDER BY depth DESC;
  // `, [id]);

  delete = id => this.ommatidia().where({ om_id: id }).del();

  relatedFiles = id => this.files().select().where({ related_om: id })
}

function reduceSubjectCodes(codes) {
  const uniqueCodes = new Set(codes.sort((a, b) => {
    if (a.ordinal < b.ordinal) return -1;
    else if (a.ordinal > b.ordinal) return 1;
    return 0;
  }).map(v => v.code));
  let str = '';
  for (const v of uniqueCodes) {
    if (str.length + v.length > 50) {
      break;
    }
    str += v;
  }
  return str;
}

export class Files {
  constructor(knex) {
    this.knex = knex;
    this.files = () => knex('files');
  }

  select = async ids => this.files().select().whereIn('related_om', makeArrayIfNot(ids));

  selectDirty = async () => this.files().select()
    .whereNull('path')
    .orWhereNull('name')
    .orWhere('updated', true);

  facetedPath = async omId => (
    Promise.map(FACETS, (facet) => {
      const table = `ommatidia_${facet}`;
      return this.knex(table)
        .join(
          this.knex.raw(`
            terms_with_roots t 
            ON :table:.term_id = t.term_id
            AND :table:.om_id IN (
              SELECT unnest(ids)
              FROM om_reduced WHERE om_id = :omId
            )`, {
              omId,
              table,
            }))
        .orderBy(`${table}.ordinal`)
        .select('t.code', 'ordinal')
        .then(reduceSubjectCodes);
    })
    .then((codes) => {
      const faceted = codes.join('');
      if (faceted.length > 0 && faceted.charAt(0) === ',') {
        return faceted.substr(1);
      }
      return faceted;
    })
  )

  updateFilepath = async (id, filepath, filename) =>
    this.files()
      .update({ path: filepath, name: filename })
      .where('file_id', id);

  static async mapData(src, omId) {
    return {
      md5: await hashFile(src),
      mimetype: await mimetype(src),
      original_name: path.basename(src),
      original_path: path.dirname(src),
      related_om: omId,
    };
  }

  async add(filepath, omId) {
    const relativeFilePath = relativeToCwd(filepath);
    const file = await Files.mapData(relativeFilePath, omId);
    console.log(chalk.gray(chalk.bold('Adding file:'), relativeFilePath));
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
