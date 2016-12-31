const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

exports.seed = function seed(knex, Promise) {
  function isFacet(name) {
    const isFacetRegex = /\(.+\)/;
    return isFacetRegex.test(name);
  }

  function addTerm(data, broaderTermId) {
    let term;
    if (typeof data === 'string') {
      term = {
        term: data,
        facet: isFacet(data.T),
      };
    } else {
      term = {
        term: data.T,
        bt: broaderTermId || null,
        facet: isFacet(data.T),
        notes: data.Notes || null,
      };
    }
    console.log('inserting:', term);

    return knex('terms').returning('term_id').insert(term)
      .then((insertedId) => {
        console.log(insertedId);
        console.log(data);
        if (broaderTermId) {
          console.log({ t_id: broaderTermId, nt_id: insertedId[0] });
          return knex('narrower_terms').insert({ t_id: broaderTermId, nt_id: insertedId[0] })
            .then(() => (data.NT ? Promise.each(data.NT, d => addTerm(d, insertedId[0])) : null));
        } else if (data.NT) {
          return Promise.each(data.NT, d => addTerm(d, insertedId[0]));
        }
        return null;
      });
  }

  function addRelations(data) {
    if (data.RT) {
      return knex('terms').where('term', data.T).select('term_id')
        .then(termId => knex('related_terms').insert(data.RT.map(r => ({ t_id: termId, rt_id: r }))))
        .then(() => ((data.NT) ? addRelations(data.NT) : null));
    }
    return (data.NT) ? addRelations(data.NT) : null;
  }

  function addFacet(name, data) {
    const facet = {
      term: name,
      bt: null,
      facet: true,
      notes: data.Notes || null,
    };
    return knex('terms').returning('term_id').insert(facet)
      .then(insertedId => (data.NT ? Promise.each(data.NT, d => addTerm(d, insertedId[0])) : null));
  }

  function processTerms(doc) {
    return Promise.each(Object.keys(doc), facet => addFacet(facet, doc[facet]));
  }

  function processRelatedTerms(doc) {
    return Promise.each(Object.keys(doc), facet => addRelations(doc[facet]));
  }

  const thesaurus = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '../../thesaurus.yml'), 'utf8'));
  // Deletes ALL existing entries
  return knex('terms').del()
    .then(() => processTerms(thesaurus))
    .then(() => processRelatedTerms(thesaurus));
};
