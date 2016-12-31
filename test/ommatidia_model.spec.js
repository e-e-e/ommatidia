import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import crypto from 'crypto';

import knex from '../lib/db/knex';
import { trackedFiles, ommatidia } from '../lib/db/models/ommatidia';

chai.use(chaiAsPromised);
chai.should();

describe('the ommatidia model', () => {
  before(() => knex.migrate.rollback());
  beforeEach(() => knex.migrate.latest());
  afterEach(() => knex.migrate.rollback());

  describe('# trackedFiles.add', () => {
    const fileDataA = {
      filename: 'fileA.txt',
      path: __dirname,
      md5: crypto.createHash('md5').update('urg! testing can be horrible').digest('hex'),
    };

    const fileDataB = {
      filename: 'fileB.txt',
      path: __dirname,
      md5: crypto.createHash('md5').update('another file').digest('hex'),
    };

    it('should add file to tracked file table', () =>
      trackedFiles.add(fileDataA)
      .should.eventually.have.length(1),
    );

    it('should add multiple files to tracked file table', () =>
      trackedFiles.add([fileDataA, fileDataB])
        .should.eventually.have.length(2)
        .and.deep.equal([1, 2]),
    );

    it('should fail to add file without hash', () =>
      trackedFiles.add({ ...fileDataA, md5: null })
      .should.be.rejected,
    );

    it('should fail if it tries to add a file with the same hash', () => {
      const fileWithSameHash = {
        ...fileDataA,
        filename: 'newfile.txt',
      };
      return trackedFiles.add(fileDataA)
        .then(() => trackedFiles.add(fileWithSameHash))
        .should.be.rejectedWith(/duplicate key value violates unique constraint/);
    });
  });

  describe.only('Ommatidia', () => {
    beforeEach(() => {
      const file = {
        filename: 'fileA.txt',
        path: __dirname,
        md5: crypto.createHash('md5').update('urg! can be horrible').digest('hex'),
      };
      return knex.migrate.latest()
        .then(() => trackedFiles.add(file))
        .then((res) => {
          const meta = {
            source_file_id: res[0],
            metadata: { this: 'ok' },
            description: 'a description of my file',
          };
          return ommatidia.add(meta)
            .then(oms => ommatidia.add({ ...meta, description: 'second', parent: oms[0] }))
            .then(oms => ommatidia.add({ ...meta, description: 'third', parent: oms[0] }))
            .then(oms => ommatidia.add({ ...meta, description: 'last', parent: oms[0] }));
        });
    });

    it('twgsdfs', () =>
      ommatidia.getFull(3).tap(console.log),
    );

    // it('should have three metadata files', () =>
    //   ommatidia.all().should.eventually.have.length(4),
    // );

    // it('deleting second metadata should give third one its parent', () =>
    //   ommatidia.delete(2)
    //     .then(() => ommatidia.get(3))
    //     .then(result => result[0])
    //     .should.eventually.have.property('parent', 1),
    // );
  });
});
