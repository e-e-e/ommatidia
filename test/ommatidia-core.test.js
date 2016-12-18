import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import mock from 'mock-fs';

chai.use(chaiAsPromised);
chai.should();

describe('iterate over source directory', () => {
  beforeEach(() => {
    mock({
      'src-dir/': {
        '*test.md': `
          ---
          this: beforeEach
          ---
          # heading
          - ok 
        `,
      },
      'fake-file': 'file contents',
    });
  });
  afterEach(mock.restore);
  it('should find return all .md files with prefix *', (done) => {
    done();
  });
});
