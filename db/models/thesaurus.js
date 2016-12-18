import knex from '../knex';

function Terms() {
  return knex('terms');
}

export function getAllTerms() {
  return Terms().select();
}
