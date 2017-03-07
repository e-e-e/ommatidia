import fs from 'fs';
import streamToPromise from 'stream-to-promise';

const returns = value => () => value;

export default function transcode(from, to) {
  const input = fs.createReadStream(from);
  const output = fs.createWriteStream(to);
  input.pipe(output);
  return Promise.all([
    streamToPromise(input).then(returns(from)),
    streamToPromise(output).then(returns(to)),
  ]);
}
