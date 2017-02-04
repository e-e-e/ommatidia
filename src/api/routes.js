import express from 'express';
import Thesaurus from '../db/models/thesaurus';
import { OmmatidiaMetadata, Files, TrackedFiles } from '../db/models/ommatidia';

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

  db.ommatidiaMetadata.refresh().then(console.log).catch(console.error);

  router.get('/subjects', (req, res) => {
    db.thesaurus.allTerms()
      .then(sendJson(res))
      .catch(handleErrors(res));
  });

  router.get('/ommatidia', (req, res) => {
    const { id } = req.query;
    const promise = id === undefined
      ? db.ommatidiaMetadata.selectRoots()
      : db.ommatidiaMetadata.select(id);
    promise
      .map(om => (
        db.ommatidiaMetadata.selectChildrenOf(om.om_id)
          .then(children => ({ ...om, children }))
      ))
      .then(sendJson(res))
      .catch(handleErrors(res));
  });

  router.get('/files', (req, res) => {
    const { id } = req.query;
    db.files.select(id)
      .then(sendJson(res))
      .catch(handleErrors(res));
  });

  return router;
};
