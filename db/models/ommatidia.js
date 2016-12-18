import knex from '../knex';

const TrackedFiles = () => knex('tracked_files');
const Files = () => knex('files');
const Ommatidia = () => knex('ommatidia');

export const trackedFiles = {
  add: file => TrackedFiles().insert(file).returning('tracked_id'),
  all: () => trackedFiles().select(),
  get: hash => TrackedFiles().select().where({ md5: hash }),
  delete: fileId => TrackedFiles().where({ file_id: fileId }).del(),
  effected: fileId => Ommatidia().select().where({ source_file_id: fileId }),
};

export const ommatidia = {
  add: om => Ommatidia().insert(om).returning('om_id'),
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
