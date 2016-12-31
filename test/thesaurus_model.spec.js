import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { getAllTerms } from '../lib/db/models/thesaurus';

chai.use(chaiAsPromised);
chai.should();

describe('the thesaurus model', () => {
  it('should return all terms', (done) => {
    const allTerms = getAllTerms();
    allTerms.should.eventually.have.length(64).notify(done);
  });
});
