
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
    CREATE OR REPLACE FUNCTION baseFacetCode(ordinal int) RETURNS text
    AS $$
    DECLARE
      facets  text[];
    BEGIN
      facets = array[',', ';' , ':', '''' , '.'];
      RETURN facets[ordinal+1];
    END
    $$ LANGUAGE plpgsql;
  `))
  .then(() => knex.raw(`
    CREATE OR REPLACE FUNCTION subjectCode(ordinal int, facet boolean DEFAULT false ) RETURNS text
    AS $$
    DECLARE
      x int; 
    BEGIN
      IF facet THEN 
        IF ordinal < 26 THEN
          x := ordinal + 65;
          return CHR(x);
        ELSE 
          return '-' || subjectCode(ordinal - 26, facet);
        END IF;
      ELSE 
        x := ordinal + 1;
        IF (x > 9 AND x < (26 + 9)) THEN
          RETURN CHR(97 + (x - 9));
        ELSIF (x >= 26 + 9) THEN
          RETURN '0' || subjectCode(x - (26 + 9), facet);
        ELSE
          RETURN x;
        END IF;
      END IF;
    END
    $$ LANGUAGE plpgsql;
  `))
  .then(() => knex.raw(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS terms_with_roots 
    AS
      WITH RECURSIVE root_parent AS (
        SELECT t.term_id, t.term, t.facet, t.bt,
          t.term_id::INT AS root, 
          1::INT AS depth, 
          baseFacetCode(t.ordinal)::TEXT AS code
        FROM terms AS t 
        WHERE t.bt IS NULL
      UNION ALL
        SELECT t.term_id, t.term, t.facet, t.bt, 
          p.root, 
          p.depth + 1 AS depth,
          p.code || subjectCode(t.ordinal, t.facet) AS code
        FROM root_parent AS p, terms AS t 
        WHERE t.bt = p.term_id
      )
      SELECT * FROM root_parent AS n ORDER BY n.term_id ASC
    WITH NO DATA;
  `))
);

exports.down = knex => (
  knex.raw('DROP MATERIALIZED VIEW IF EXISTS terms_with_roots')
    .then(() => knex.raw('DROP FUNCTION baseFacetCode(int);'))
    .then(() => knex.raw('DROP FUNCTION subjectCode(int, boolean);'))
    .then(() => knex.schema.dropTable('narrower_terms'))
    .then(() => knex.schema.dropTable('related_terms'))
    .then(() => knex.schema.dropTable('terms'))
);
