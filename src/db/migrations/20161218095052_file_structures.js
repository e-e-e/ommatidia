import { FACETS } from '../../consts';

const createOverrideIfNullFunctionWithType = type => `
      CREATE OR REPLACE FUNCTION overrideIfNull(${type} = NULL,${type} = NULL) RETURNS ${type} AS $$
      BEGIN
        IF $1 IS NULL THEN
          RETURN $2;
        END IF;
        RETURN $1;
      END;
      $$ LANGUAGE plpgsql;
    `;
const dropOverrideIfNullFunctionWithType = type => `DROP FUNCTION IF EXISTS overrideIfNull(${type},${type});`;

const relationsOmmatidiaToTerms = (table) => {
  table.integer('om_id').unsigned();
  table.integer('term_id').unsigned();
  table.foreign('om_id').references('ommatidia.om_id')
       .onUpdate('CASCADE')
       .onDelete('CASCADE');
  table.foreign('term_id').references('terms.term_id')
       .onUpdate('CASCADE')
       .onDelete('CASCADE');
  table.unique(['om_id', 'term_id']);
};

exports.up = (knex, Promise) => (
  knex.schema.raw(`
      CREATE FUNCTION sync_lastmod() RETURNS trigger AS $$
      BEGIN
        NEW.modified_at := NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
  .then(() =>
    knex.schema.raw(`
      CREATE FUNCTION replace_parent_with_parent() RETURNS trigger AS $$
      BEGIN
        UPDATE ommatidia SET parent = OLD.parent WHERE parent = OLD.om_id;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `))
  .then(() =>
    knex.schema.raw(`
      CREATE OR REPLACE FUNCTION getAllSubjects(int[], text) RETURNS TABLE(f1 json[]) AS $$
      BEGIN
        RETURN QUERY EXECUTE format('
        SELECT ARRAY( 
          SELECT json_build_object(''id'', t.term_id, ''term'',t.term) FROM %I s 
          INNER JOIN terms t ON s.term_id = t.term_id AND s.om_id = ANY(''%s''::int[]) 
        WHERE t.facet = FALSE 
        ORDER BY t.term_id)', 'ommatidia_'||$2, $1);
      END
      $$ LANGUAGE plpgsql;
    `))
  .then(() => knex.schema.raw(createOverrideIfNullFunctionWithType('text')))
  .then(() => knex.schema.raw(createOverrideIfNullFunctionWithType('int')))
  .then(() =>
    Promise.all([
      knex.schema.createTable('tracked_files', (table) => {
        table.increments('tracked_id');
        table.string('md5', 32).unique().notNullable();
        table.string('filename').notNullable();
        table.text('path').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('modified_at').defaultTo(knex.fn.now());
        table.unique(['filename', 'path']);
      }),

      knex.schema.createTable('ommatidia', (table) => {
        table.increments('om_id');
        table.boolean('om_base').defaultTo(false);
        table.integer('source_file_id').unsigned().notNullable();
        table.integer('parent').unsigned();
        table.text('title');
        table.text('description');
        table.jsonb('metadata');
        table.foreign('source_file_id').references('tracked_files.tracked_id')
             .onUpdate('CASCADE')
             .onDelete('CASCADE');
        table.foreign('parent').references('ommatidia.om_id')
             .onUpdate('CASCADE')
             .onDelete('NO ACTION');
      }),

      knex.schema.createTable('files', (table) => {
        table.increments('file_id');
        table.integer('related_om').unsigned();
        table.string('name');
        table.text('path');
        table.boolean('updated').defaultTo(false).notNullable();
        table.string('original_name').notNullable();
        table.text('original_path').notNullable();
        table.string('md5', 32).unique().notNullable();
        table.string('mimetype');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('modified_at').defaultTo(knex.fn.now());
        table.foreign('related_om').references('ommatidia.om_id')
             .onUpdate('CASCADE')
             .onDelete('SET NULL');
      }),
      Promise.all(FACETS.map(facet => knex.schema.createTable(`ommatidia_${facet}`, relationsOmmatidiaToTerms))),
    ]))
    .then(() => knex.schema.raw('CREATE TRIGGER sync_lastmod BEFORE UPDATE ON files FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();'))
    .then(() => knex.schema.raw('CREATE TRIGGER sync_lastmod BEFORE UPDATE ON tracked_files FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();'))
    .then(() => knex.schema.raw('CREATE TRIGGER replace_parent_with_parent AFTER DELETE ON ommatidia FOR EACH ROW EXECUTE PROCEDURE replace_parent_with_parent();'))
    .then(() => knex.schema.raw(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS om_reduced 
      AS 
      WITH RECURSIVE om_compressed AS (
        SELECT
          om.om_id,
          om.om_base,
          om.parent,
          om.title,
          om.description,
          om.metadata,
          om.om_id AS root,
          Array[om_id] AS ids,
          1 AS depth
        FROM ommatidia om
        WHERE om.parent IS NULL
      UNION ALL
        SELECT 
          om.om_id,
          om.om_base,
          om.parent,
          overrideIfNull(om.title, c.title),
          overrideIfNull(om.description, c.description),
          c.metadata || om.metadata,
          c.root AS root,
          c.ids || Array[om.om_id] AS ids,
          depth + 1 AS depth
        FROM  ommatidia om, om_compressed c
        WHERE om.parent = c.om_id
      )
      SELECT 
        n.om_id,
        n.om_base,
        n.parent,
        n.title,
        n.description,
        n.metadata,
        n.ids,
        n.root,
        n.depth,
        getAllSubjects(n.ids,'energy') as energy,
        getAllSubjects(n.ids,'personality') as personality,
        getAllSubjects(n.ids,'matter') as matter,
        getAllSubjects(n.ids,'space') as space,
        getAllSubjects(n.ids,'time') as time
      FROM om_compressed n
      ORDER BY n.om_id
      WITH NO DATA;
    `))
);

exports.down = knex => (
  knex.schema.raw('DROP MATERIALIZED VIEW IF EXISTS om_reduced')
    .then(() => knex.schema.raw('DROP FUNCTION IF EXISTS sync_lastmod() CASCADE;'))
    .then(() => knex.schema.raw(dropOverrideIfNullFunctionWithType('text')))
    .then(() => knex.schema.raw(dropOverrideIfNullFunctionWithType('int')))
    .then(() => knex.schema.raw('DROP FUNCTION IF EXISTS getAllSubjects(int[], text) CASCADE;'))
    .then(() => knex.schema.raw('DROP FUNCTION IF EXISTS replace_parent_with_parent() CASCADE;'))
    .then(() => Promise.all(FACETS.map(facet => knex.schema.dropTable(`ommatidia_${facet}`))))
    .then(() => knex.schema.dropTable('files'))
    .then(() => knex.schema.dropTable('ommatidia'))
    .then(() => knex.schema.dropTable('tracked_files'))
);
