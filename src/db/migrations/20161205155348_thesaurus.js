
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
);

exports.down = knex => (
  knex.schema.dropTable('narrower_terms')
    .then(() => knex.schema.dropTable('related_terms'))
    .then(() => knex.schema.dropTable('terms'))
);
