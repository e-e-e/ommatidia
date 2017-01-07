
exports.up = (knex, Promise) => (
  Promise.all([
    knex.schema.createTable('terms', (table) => {
      table.increments('term_id');
      table.string('term').notNullable().unique();
      table.integer('bt').unsigned();
      table.boolean('facet').notNullable().defaultTo('false');
      table.string('notes');
      table.integer('ordinal').unsigned();
      table.foreign('bt').references('terms.term_id')
           .onUpdate('CASCADE')
           .onDelete('CASCADE');
    }),

    knex.schema.createTable('narrower_terms', (table) => {
      table.integer('t_id').unsigned();
      table.integer('nt_id').unsigned();

      table.foreign('t_id').references('terms.term_id')
           .onUpdate('CASCADE')
           .onDelete('CASCADE');
      table.foreign('nt_id').references('terms.term_id')
           .onUpdate('CASCADE')
           .onDelete('CASCADE');
      table.unique(['t_id', 'nt_id']);
    }),

    knex.schema.createTable('related_terms', (table) => {
      table.integer('t_id').unsigned();
      table.integer('rt_id').unsigned();
      table.foreign('t_id').references('terms.term_id')
           .onUpdate('CASCADE')
           .onDelete('CASCADE');
      table.foreign('rt_id').references('terms.term_id')
           .onUpdate('CASCADE')
           .onDelete('CASCADE');
      table.unique(['t_id', 'rt_id']);
    }),
  ])
  .then(() => knex.raw(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS terms_with_roots 
    AS
      WITH RECURSIVE root_parent AS (
        SELECT t.term_id, t.term, t.facet, t.bt, t.term_id::INT AS root, 1::INT AS depth 
        FROM terms AS t 
        WHERE t.bt IS NULL
      UNION ALL
        SELECT t.term_id, t.term, t.facet, t.bt, p.root, p.depth + 1 AS depth 
        FROM root_parent AS p, terms AS t 
        WHERE t.bt = p.term_id
      )
      SELECT * FROM root_parent AS n ORDER BY n.term_id ASC
    WITH NO DATA;
  `))
);

exports.down = knex => (
  knex.raw('DROP MATERIALIZED VIEW IF EXISTS terms_with_roots')
    .then(() => knex.schema.dropTable('narrower_terms'))
    .then(() => knex.schema.dropTable('related_terms'))
    .then(() => knex.schema.dropTable('terms'))
);
