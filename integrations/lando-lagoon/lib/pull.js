'use strict';

// Modules
const _ = require('lodash');
const auth = require('./auth');
const os = require('os');
const path = require('path');

const {parseKey, getPreferredKey} = require('./keys');
const LagoonApi = require('./api');

const getEnvironmentChoices = (key, lando, projectName) => {
  const api = new LagoonApi(key, lando);
  return api.auth().then(() => api.getEnvironments(projectName).then(environments => {
    return _(environments)
      .map(env => ({name: env.openshiftProjectName, value: env.openshiftProjectName}))
      .concat([{name: 'none', value: 'none'}])
      .value();
  }));
};

// The non dynamic base of the task
const task = {
  service: 'cli',
  description: 'Pull db and files from Lagoon',
  cmd: '/helpers/lagoon-pull.sh',
  level: 'app',
  stdio: ['inherit', 'pipe', 'pipe'],
  options: {
    auth: {
      describe: 'Lagoon key',
      passthrough: true,
      string: true,
      interactive: {
        type: 'list',
        message: 'Choose a Lagoon account',
        when: () => false,
        weight: 100,
      },
    },
    database: {
      description: 'The environment from which to pull the database',
      passthrough: true,
      alias: ['d'],
      interactive: {
        type: 'list',
        message: 'Pull database from?',
        weight: 601,
      },
    },
    files: {
      description: 'The environment from which to pull the files',
      passthrough: true,
      alias: ['f'],
      interactive: {
        type: 'list',
        message: 'Pull files from?',
        weight: 602,
      },
    },
  },
};

// Helper to populate defaults
const getDefaults = (task, options) => {
  // Get the project name
  const project = _.get(options, '_app.lagoon.config.lagoon.project', options._app.name);
  // Set interactive options
  _.forEach(['database', 'files'], name => {
    task.options[name].interactive.choices = answers => {
      // Parse key and add to answers as a hidden var
      const {keyPath, host, port} = parseKey(getPreferredKey(answers));
      answers['keyfile'] = path.join('/user', path.relative(os.homedir(), keyPath));
      answers['host'] = host;
      answers['port'] = port;
      // Return the environments
      return getEnvironmentChoices(getPreferredKey(answers), options._app._lando, project);
    };
    task.options[name].interactive.default = 'main';
  });

  // Set envvars
  task.env = {
    LANDO_LEIA: _.toInteger(options._app._config.leia),
    LANDO_LAGOON_PROJECT: project,
  };

  return task;
};

/*
 * Helper to build a pull command
 */
exports.getPull = (options, keys = [], lando = {}) => {
  return _.merge({}, getDefaults(task, options), {options: auth.getAuthOptions(options._app.meta, keys, lando)});
};
