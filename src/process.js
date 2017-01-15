import path from 'path';

import Promise from 'bluebird';
import _ from 'lodash';
import chalk from 'chalk';

import { loadOmmatidiaFile } from './utils';

import { FACETS } from './consts';

export default (db) => {

  const processFacet = async (omId, facet, subjects) => {
    if (!subjects || subjects.length === 0) return null;
    const availableSubjects = await db.thesaurus.allTermsByFacet(facet);
    const subjectsToAdd = subjects
      .map((term, index, self) => {
        const subject = availableSubjects.find(s => s.term === term);
        if (subject === undefined) {
          console.log(chalk.yellow(`Subject ${chalk.bold(term)} was not found within the ${chalk.bold(facet)} facet.`));
        }
        if (self.indexOf(term) !== index) {
          console.log(chalk.yellow(`Subject ${chalk.bold(term)} is duplicated in the ${chalk.bold(facet)} facet.`));
          return undefined;
        }
        return subject;
      })
      .filter(subject => subject !== undefined);
    if (subjectsToAdd.length) {
      console.log(chalk.gray('Attempting to add subjects:', subjectsToAdd.map(s => s.term).join(',')));
      await db.ommatidiaMetadata.addSubjects(omId, facet, subjectsToAdd);
    }
    return subjectsToAdd;
  };

  const processOmSubjects = async (omId, subjects) => {
    if (typeof subjects === 'object') {
      const addedSubjects = await Promise.all(FACETS.map(facet => processFacet(omId, facet, subjects[facet])));
      console.log('wooooo', addedSubjects.map(s => s && s.map(subject => subject.code).join('')).join(''));
    }
    return '';
  };

  const processOmFile = (dir, baseOmId, include, sourceFileId) =>
    async ({ omFile, relatedFile }) => {
      let parent = baseOmId;
      const omFilepath = path.join(dir, omFile);
      const specificOmData = loadOmmatidiaFile(omFilepath);
      if (include) {
        const otherMetadata = include[relatedFile];
        if (otherMetadata && !_.isEmpty(otherMetadata)) {
          parent = await db.ommatidiaMetadata.add(otherMetadata, sourceFileId, baseOmId);
        }
      }
      const omSourceFileId = await db.trackedFiles.add(omFilepath);
      if (omSourceFileId === undefined) return null;
      const omId = await db.ommatidiaMetadata.add(specificOmData, omSourceFileId, parent);
      await processOmSubjects(omId, specificOmData.meta.subjects);
      return db.files.add(path.join(dir, relatedFile), omId);
    };

  const processInclude = (baseOmId, sourceFileId) =>
    async ({ filepath, metadata }) => {
      let metaId = baseOmId;
      if (!_.isEmpty(metadata)) {
        metaId = await db.ommatidiaMetadata.add(metadata, sourceFileId, baseOmId);
      }
      await db.files.add(filepath, metaId);
    };

  const processDirectory = async (dir, { folders, omFiles, notOmFiles, baseOm }, parentId) => {
    let baseOmId = parentId;

    if (baseOm) {
      const sourceFileId = await db.trackedFiles.add(baseOm.baseOmFilepath);
      if (sourceFileId === undefined) return baseOmId;
      baseOmId = await db.ommatidiaMetadata.add(baseOm.omData, sourceFileId, parentId, true);
      await processOmSubjects(baseOmId, baseOm.omData.meta.subjects);
      await Promise.each(omFiles, processOmFile(dir, baseOmId, baseOm.include, sourceFileId));

      if (baseOm.include) {
        let filesStillToInclude = _.omit(baseOm.include, omFiles.map(om => om.relatedFile));
        filesStillToInclude = _.map(filesStillToInclude,
          (v, k) => ({ filepath: path.join(dir, k), metadata: v }));
        await Promise.each(filesStillToInclude, processInclude(baseOmId, sourceFileId));
      }
    } else {
      // just process omFiles
      await Promise.each(omFiles, processOmFile(dir, baseOmId));
    }
    return baseOmId;
  };

  return processDirectory;
};
