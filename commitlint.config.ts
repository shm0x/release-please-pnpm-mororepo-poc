import { readdirSync } from 'fs';

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [1, 'always', Infinity],
    'footer-max-line-length': [1, 'always', Infinity],
    'scope-enum': [
      2,
      'always',
      [
        'all',
        'deps',
        'deps-dev',
        'github',
        'packages',
        'release',
        'root',
        'scripts',
        'templates',
        ...readdirSync('./packages'),
      ],
    ],
    'scope-empty': [1, 'never'],
  },
};
