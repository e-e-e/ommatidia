import fs from 'fs';
import path from 'path';
import gm from 'gm';
import Promise from 'bluebird';
import streamToPromise from 'stream-to-promise';

const im = gm.subClass({ imageMagick: true });

const defaultOptions = {
  thumbnail: {
    type: 'jpg',
    resize: { width: 200, height: 200, options: '^' },
    crop: {
      gravity: 'Center',
      width: 200,
      height: 200,
    },
    quality: '85',
  },
  medium: {
    type: 'jpg',
    resize: { width: 500, height: 500 },
    quality: '85',
  },
  large: {
    type: 'jpg',
    resize: { width: 1000, height: 1000 },
    quality: '85',
  },
  tiny: {
    type: 'jpg',
    resize: { width: 10 },
    monochrome: true,
    quality: '75',
  },
};

const operations = processes => (prev, operation) => {
  const options = processes[operation];
  // console.log('performing', operation);
  switch (operation) {
    case 'resize':
      return prev.resize(options.width, options.height, options.options);
    case 'monochrome':
      return (options) ? prev.type('Grayscale') : prev;
    case 'quality':
      return prev.quality(options);
    case 'crop':
      return (options.gravity)
        ? prev.gravity(options.gravity).crop(options.width, options.height)
        : prev.crop(options.width, options.height);
    default:
      return prev;
  }
};

const returns = value => () => value;

function transcode(from, to, options = defaultOptions) {
  const input = fs.createReadStream(from);
  const file = path.parse(to);
  const labels = Object.keys(options);
  const promised = Promise.map(labels, (label) => {
    const processes = Object.keys(options[label]);
    const img = processes.reduce(operations(options[label]), im(input));
    const newFilepath = `${file.dir}/${file.name}-${label}${file.ext}`;
    // what if it already exists? overright? or not?
    const newFile = fs.createWriteStream(newFilepath);
    img.stream(processes.type).pipe(newFile);
    return streamToPromise(newFile).then(returns(newFilepath));
  });
  return Promise.all([
    streamToPromise(input).then(returns(from)),
    promised,
  ]);
}

export default transcode;
