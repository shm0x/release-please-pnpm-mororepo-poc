process.env.AWS_REGION = 'eu-central-1';

module.exports = {
  branches: [
    'main',
    {
      name: 'feature/dependabot-pkgs-upgrade',
      prerelease: 'feature-dependabot-pkgs-upgrade',
    },
    {
      name: 'fork/*',
      prerelease: '${name.replace(/^fork\\//g, "fork-")}',
    },
  ],
  extends: 'semantic-release-monorepo',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        releaseRules: [
          { type: 'refactor', release: 'minor' },
          { type: 'revert', release: 'patch' },
        ],
      },
    ],
    '@semantic-release/changelog',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'pnpm version ${nextRelease.version} --no-workspaces-update --git-tag-version=false --allow-same-version',
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'lerna.json',
          'package.json',
          'pnpm-lock.yaml',
          'packages/*/package.json',
        ],
      },
    ],
  ],
};
