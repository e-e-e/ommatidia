const path = require('path');

module.exports = {
  test: {
    client: 'pg',
    connection: 'postgres://localhost/ommatidia_test',
    migrations: {
      directory: path.join(__dirname, '/src/db/migrations'),
    },
    seeds: {
      directory: path.join(__dirname, '/src/db/seeds/test'),
    },
  },
  development: {
    client: 'pg',
    connection: 'postgres://localhost/ommatidia',
    migrations: {
      directory: path.join(__dirname, '/src/db/migrations'),
    },
    seeds: {
      directory: path.join(__dirname, '/src/db/seeds/development'),
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: path.join(__dirname, '/lib/db/migrations'),
    },
    seeds: {
      directory: path.join(__dirname, '/lib/db/seeds/production'),
    },
  },
};
