
exports.seed = knex => (
  knex('tracked_files').del()
    .then(() => knex('ommatidia').del())
    .then(() => knex('files').del())
);
