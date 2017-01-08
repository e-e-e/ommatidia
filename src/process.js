import path from 'path';

import Promise from 'bluebird';
import _ from 'lodash';
import chalk from 'chalk';

import { loadOmmatidiaFile } from './utils';

import { FACETS } from './consts';

export default (db) => {
  const processOmSubjects = async (omId, facet, subjects) => {
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
      return db.ommatidiaMetadata.addSubjects(omId, facet, subjectsToAdd);
    }
    return null;
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
      const omId = await db.ommatidiaMetadata.add(specificOmData, omSourceFileId, parent);
      await db.files.add(path.join(dir, relatedFile), omId);
      const subjects = specificOmData.meta.subjects;
      return (typeof subjects === 'object')
        ? Promise.all(FACETS.map(facet => processOmSubjects(omId, facet, subjects[facet])))
        : null;
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
      baseOmId = await db.ommatidiaMetadata.add(baseOm.omData, sourceFileId, parentId);

      await Promise.each(omFiles, processOmFile(dir, baseOmId, baseOm.include, sourceFileId));
      const baseOmSubjects = baseOm.omData.meta.subjects;
      if (typeof baseOmSubjects === 'object') {
        await Promise.all(
          FACETS.map(facet => processOmSubjects(baseOmId, facet, baseOmSubjects[facet])),
        );
      }

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
