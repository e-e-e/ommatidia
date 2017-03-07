import mmm from 'mmmagic';
import mime from 'mime-types';
import Promise from 'bluebird';

const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
const detectFile = Promise.promisify(magic.detectFile, { context: magic });

export default function mimetype(file) {
  return detectFile(file).catch((err) => {
    console.warn(err);
    return mime.lookup(file);
  });
}
