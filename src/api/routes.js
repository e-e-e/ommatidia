import express from 'express';
import Promise from 'bluebird';
import Thesaurus from '../db/models/thesaurus';
import { OmmatidiaMetadata, Files, TrackedFiles } from '../db/models/ommatidia';
import { FACETS } from '../consts';

const handleErrors = res => (err) => {
  console.log(err);
  res.sendStatus(500);
};

const sendJson = res => data => res.json(data);

export default (knex) => {
  const router = express.Router();
  const db = {
    thesaurus: new Thesaurus(knex),
    ommatidiaMetadata: new OmmatidiaMetadata(knex),
    trackedFiles: new TrackedFiles(knex),
    files: new Files(knex),
  };

  db.ommatidiaMetadata.refresh();

  router.get('/subjects', (req, res) => {
    const promises = FACETS.map(facet => db.thesaurus.allTermsByFacet(facet));
    Promise.all(promises)
      .then(sendJson(res))
      .catch(handleErrors(res));
  });

  router.get('/ommatidia', (req, res) => {
    const { id } = req.query;
    db.ommatidiaMetadata.select(id)
      .then(sendJson(res))
      .catch(handleErrors(res));
  });

  return router;
};
