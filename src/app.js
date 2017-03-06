import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import Knex from 'knex';
import api from './api/routes'; // eslint-disable-line

export default (options) => {
  const port = options.port || 3000;
  const apiPath = options.apiPath || '/api';
  const staticPath = path.resolve(process.cwd(), options.public || './');
  const app = express();

  const knex = Knex({
    client: 'pg',
    connection: options.database || 'postgres://localhost/ommatidia',
  });

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  console.log('Serving content from:', staticPath);

  app.use('/', express.static(staticPath));

  app.use(apiPath, api(knex));

  app.listen(port, () => {
    console.log('listening on port:', port);
  });
  return app;
};
