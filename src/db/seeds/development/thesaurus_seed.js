const path = require('path');
const Thesaurus = require('../../models/thesaurus').default;

exports.seed = function seed(knex) {
  const thesaurus = new Thesaurus(knex);
  return thesaurus.build(path.join(__dirname, '../../thesaurus.yml'));
};
