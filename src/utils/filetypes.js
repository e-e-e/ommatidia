
export const getFileExtension = filename => filename.substr(filename.lastIndexOf('.') + 1);

export const isImage = file => file.mimetype.indexOf('image/') === 0;
export const isAudio = file => file.mimetype.indexOf('audio/') === 0;
export const isVideo = file => file.mimetype.indexOf('video/') === 0;
export const isPDF = file => file.mimetype.indexOf('application/pdf') === 0;
export const isMarkdown = file => file.mimetype.indexOf('text/plain') === 0 && getFileExtension(file.original_name) === 'md';
export const isPlainText = file => file.mimetype.indexOf('text/plain') === 0 && getFileExtension(file.original_name) === 'txt';
