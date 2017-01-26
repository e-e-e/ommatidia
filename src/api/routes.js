import express from 'express';
import Thesaurus from '../db/models/thesaurus';
import { OmmatidiaMetadata, Files, TrackedFiles } from '../db/models/ommatidia';

export default (knex) => {
  const router = express.Router();
  const db = {
    thesaurus: new Thesaurus(knex),
    ommatidiaMetadata: new OmmatidiaMetadata(knex),
    trackedFiles: new TrackedFiles(knex),
    files: new Files(knex),
  };

  router.get('/subjects', (req, res) => {
    //
    res.json({ subject: 'ok' });
  });

  router.get('/ommatidia', (req, res) => {
    res.json({ om: 'this' });
  });

  return router;
};
