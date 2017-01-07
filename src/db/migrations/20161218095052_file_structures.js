const relationsOmmatidiaToTerms = (table) => {
  table.integer('om_id').unsigned();
  table.integer('term_id').unsigned();
  table.foreign('om_id').references('ommatidia.om_id')
       .onUpdate('CASCADE')
       .onDelete('CASCADE');
  table.foreign('term_id').references('terms.term_id')
       .onUpdate('CASCADE')
       .onDelete('CASCADE');
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
        table.integer('source_file_id').unsigned().notNullable();
        table.integer('parent').unsigned();
        table.text('title');
        table.text('description');
        table.json('metadata');
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
        table.string('name').notNullable();
        table.text('path').notNullable();
        table.string('original_name').notNullable();
        table.text('original_path').notNullable();
        table.string('md5', 32).unique().notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('modified_at').defaultTo(knex.fn.now());
        table.foreign('related_om').references('ommatidia.om_id')
             .onUpdate('CASCADE')
             .onDelete('SET NULL');
      }),

      knex.schema.createTable('ommatidia_personality', relationsOmmatidiaToTerms),
      knex.schema.createTable('ommatidia_matter', relationsOmmatidiaToTerms),
      knex.schema.createTable('ommatidia_energy', relationsOmmatidiaToTerms),
      knex.schema.createTable('ommatidia_space', relationsOmmatidiaToTerms),
      knex.schema.createTable('ommatidia_time', relationsOmmatidiaToTerms),
    ]))
    .then(() => knex.schema.raw('CREATE TRIGGER sync_lastmod BEFORE UPDATE ON files FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();'))
    .then(() => knex.schema.raw('CREATE TRIGGER sync_lastmod BEFORE UPDATE ON tracked_files FOR EACH ROW EXECUTE PROCEDURE sync_lastmod();'))
    .then(() => knex.schema.raw('CREATE TRIGGER replace_parent_with_parent AFTER DELETE ON ommatidia FOR EACH ROW EXECUTE PROCEDURE replace_parent_with_parent();'))
);

exports.down = knex => (
  knex.schema.raw('DROP FUNCTION IF EXISTS sync_lastmod() CASCADE;')
    .then(() => knex.schema.raw('DROP FUNCTION IF EXISTS replace_parent_with_parent() CASCADE;'))
    .then(() => knex.schema.dropTable('ommatidia_personality'))
    .then(() => knex.schema.dropTable('ommatidia_matter'))
    .then(() => knex.schema.dropTable('ommatidia_energy'))
    .then(() => knex.schema.dropTable('ommatidia_space'))
    .then(() => knex.schema.dropTable('ommatidia_time'))
    .then(() => knex.schema.dropTable('files'))
    .then(() => knex.schema.dropTable('ommatidia'))
    .then(() => knex.schema.dropTable('tracked_files'))
);
