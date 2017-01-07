import fs from 'fs';

import Promise from 'bluebird';
import yaml from 'js-yaml';
import _ from 'lodash';

const isFacet = name => /\(.+\)/.test(name);

export default class Thesaurus {
  constructor(knex) {
    this.knex = knex;
    this.Terms = () => knex('terms');
    this.RelatedTerms = () => knex('related_terms');
    this.NarrowerTerms = () => knex('narrower_terms');
    this.TermsWithRoots = () => knex('terms_with_roots');
  }

  // GETTER FUNCTIONS

  facetId = _.memoize(facet =>
    this.Terms()
      .where('term', `(by ${facet})`)
      .andWhere('bt', null)
      .select('term_id'),
    )

  allTermsByFacet = _.memoize(facet =>
    this.TermsWithRoots()
      .where('root', 'in', this.facetId(facet))
      .andWhere('facet', false)
      .select('term', 'term_id'),
    )

  count(includeFacets = false) {
    const query = (includeFacets)
      ? this.Terms().count()
      : this.Terms().where('facet', false).count();
    return query.then(results => results[0].count);
  }

  // viewExists() {
  //   return this.knex
  // .raw('select count(*) from pg_class where relname=\'terms_with_roots\' and relkind=\'m\'');
  // }

  // SETTER FUNCTIONS

  refreshView() {
    return this.knex.raw('REFRESH MATERIALIZED VIEW terms_with_roots WITH DATA');
  }

  build(thesaurusFile) {
    const addTerm = (data, broaderTermId, ordinal) => {
      let term;
      if (typeof data === 'string') {
        term = {
          term: data,
          facet: isFacet(data.T),
          ordinal,
        };
      } else {
        term = {
          term: data.T,
          bt: broaderTermId || null,
          facet: isFacet(data.T),
          notes: data.Notes || null,
          ordinal,
        };
      }
      console.log('inserting:', term);

      return this.Terms().returning('term_id').insert(term)
        .then((insertedId) => {
          console.log(insertedId);
          console.log(data);
          if (broaderTermId) {
            console.log({ t_id: broaderTermId, nt_id: insertedId[0] });
            return this.NarrowerTerms().insert({ t_id: broaderTermId, nt_id: insertedId[0] })
              .then(() => (data.NT
                ? Promise.each(data.NT, (d, i) => addTerm(d, insertedId[0], i))
                : null));
          } else if (data.NT) {
            return Promise.each(data.NT, (d, i) => addTerm(d, insertedId[0], i));
          }
          return null;
        });
    };

    const addFacet = (name, data, ordinal) => {
      const facet = {
        term: name,
        bt: null,
        facet: true,
        notes: data.Notes || null,
        ordinal,
      };
      return this.Terms().returning('term_id').insert(facet)
        .then(insertedId => (data.NT
          ? Promise.each(data.NT, (d, index) => addTerm(d, insertedId[0], index))
          : null));
    };

    const addRelations = (data) => {
      if (data.RT) {
        return this.Terms().where('term', data.T).select('term_id')
          .then(termId => this.RelatedTerms.insert(data.RT.map(r => ({ t_id: termId, rt_id: r }))))
          .then(() => ((data.NT) ? addRelations(data.NT) : null));
      }
      return (data.NT) ? addRelations(data.NT) : null;
    };

    const processTerms = doc =>
      Promise.each(Object.keys(doc), (facet, index) => addFacet(facet, doc[facet], index));
    const processRelatedTerms = doc =>
      Promise.each(Object.keys(doc), facet => addRelations(doc[facet]));
    const thesaurus = yaml.safeLoad(fs.readFileSync(thesaurusFile, 'utf8'));
    // Deletes ALL existing entries
    return this.Terms().del()
      .then(() => processTerms(thesaurus))
      .then(() => processRelatedTerms(thesaurus));
  }
}

