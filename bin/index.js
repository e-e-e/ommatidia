#!/usr/bin/env node
const Promise = require('bluebird');
const Liftoff = require('liftoff');
const chalk = require('chalk');
const commander = require('commander');
const argv = require('minimist')(process.argv.slice(2));
const cliPkg = require('../package');
const Ommatidia = require('../lib/cli.js').default;


function exit(text) {
  if (text instanceof Error) {
    console.error(chalk.red(text.stack));
  } else {
    console.error(chalk.red(text));
  }
  process.exit(1);
}

function success(text) {
  console.log(text);
  process.exit(0);
}

function initOmmatidia(env) {
  if (!env.configPath) {
    exit('No ommatidia config file found in this directory. Specify a path with --omfile');
  } else if (process.cwd() !== env.configBase) {
    console.log(env.configBase);
    process.chdir(env.configBase);
  }
  const config = require(env.configPath); // eslint-disable-line
  return new Ommatidia(config);
}

function invoke(env) {
  if (argv.verbose) {
    console.log('LIFTOFF SETTINGS:', this);
    console.log('CLI OPTIONS:', argv);
    console.log('CWD:', env.cwd);
    console.log('LOCAL MODULES PRELOADED:', env.require);
    console.log('SEARCHING FOR:', env.configNameRegex);
    console.log('FOUND CONFIG AT:', env.configPath);
    console.log('CONFIG BASE DIR:', env.configBase);
    console.log('YOUR LOCAL MODULE IS LOCATED:', env.modulePath);
    console.log('LOCAL PACKAGE.JSON:', env.modulePackage);
    console.log('CLI PACKAGE.JSON', require('../package')); // eslint-disable-line
  }

  let pending = null;

  commander.version(chalk.blue(`Ommatidia CLI version: ${chalk.green(cliPkg.version)}\n`));

  commander.command('status')
    .alias('s')
    .description('Outputs the current status of Ommatidia.')
    .option('-v, --verbose')
    .action((options) => {
      console.log('STATUS');
      pending = initOmmatidia(env)
        .status(options)
        .then(() => success())
        .catch(exit);
    });

  commander.command('init')
    .description('Initialise Ommatidia database tables using ommatidia config file.')
    .option('-v, --verbose')
    .option('-f, --force', 'Force rebuild of database tables.')
    .action((options) => {
      console.log('INIT');
      pending = initOmmatidia(env)
        .initialiseDatabase(options)
        .then(() => success('Successfully Initialised Database!'))
        .catch(exit);
    });

  commander.command('build')
    .description('Build Ommatidia database and files structure using ommatidia config file.')
    .option('-v, --verbose')
    .option('-n, --dry-run', 'Shows files that would be effected.')
    .option('-f, --force', 'Force rebuild of ommatidia data, if database already built.')
    .action((options) => {
      console.log('BUILD');
      pending = initOmmatidia(env)
        .build(options)
        .then(() => success('Successfully built ommatidia directory!'))
        .catch(exit);
    });

  commander.command('propagate')
    .description('Propagate changes flagged in build and files structure using ommatidia config file.')
    .option('-v, --verbose')
    .option('-n, --dry-run', 'Shows files that would be effected.')
    .option('-f, --force', 'Force rebuild of ommatidia data, if database already built.')
    .action((options) => {
      pending = initOmmatidia(env)
        .propagate(options)
        .then(() => success('Successfully propagated ommatidia directory!'))
        .catch(exit);
    });

  commander.command('update')
    .description('Update Ommatidia database using ommatidia config file.')
    .option('-v, --verbose')
    .option('-n, --dry-run', 'Shows files that would be effected.')
    .option('-f, --force', 'Force rebuild of ommatidia data, if database already built.')
    .action((options) => {
      console.log('UPDATE');
      pending = initOmmatidia(env)
        .update(options)
        .then(() => success('Successfully updated ommatidia directory!'))
        .catch(exit);
    });

  commander.command('make <files...>')
    .description('Create new empty *.<fn>.om files for specified files.')
    .action((files) => {
      pending = Promise.each(files, filename => Ommatidia.makeOmFile(filename))
        .then(() => success('Successfully made om files!'))
        .catch(exit);
    });

  commander.command('make:base')
    .description('Create new empty *.om file.')
    .action(() => {
      pending = Ommatidia.makeOmFile()
        .then(() => success('Successfully made a new empty *.om file!'))
        .catch(exit);
    });

  commander.parse(process.argv);

  Promise.resolve(pending)
    .then(() => commander.help());
}

const cli = new Liftoff({
  name: 'ommatidia',
  configName: 'ommatidia',
  extensions: {
    '.js': null,
    '.json': null,
  },
});

cli.on('require', (name) => {
  console.log('Requiring external module', chalk.magenta(name));
});

cli.on('requireFail', (name) => {
  console.log(chalk.red('Failed to load external module'), chalk.magenta(name));
});

cli.launch({
  cwd: argv.cwd,
  configPath: argv.omfile,
  require: argv.require,
  completion: argv.completion,
}, invoke);
