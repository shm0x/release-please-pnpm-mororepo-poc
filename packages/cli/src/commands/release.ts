import chalk from 'chalk';

import { Command } from '../command';
export type Commit = {
  hash: string;
  timestamp: Date;
  message: string;
  type: string;
  scope: string;
  isBreakingChange: boolean;
  files: string[];
};

export type Bump = {
  name: string;
  root: string;
  type: 'major' | 'minor' | 'patch';
  major: boolean;
  minor: boolean;
  patch: boolean;
  current: string;
  new: string;
  commits: Commit[];
  json: Record<string, any>;
  depsToBump: Record<string, string>;
};

export type Context = {
  commits: Commit[];
  changelog: string;
  bumps: Record<string, Bump>;
};

export class ReleaseCommand extends Command {
  static description = 'Prepare a new release';
  options = {
    from: {
      description: 'Start commit',
      type: 'string',
    },
    to: {
      description: 'End commit',
      type: 'string',
    },
  };
  mappings = {};

  state: Context = {
    commits: [],
    bumps: {},
    changelog: '',
  };
  async execute(inputs: string[]) {
    const { command, flags, args } = this.formatInputs(inputs);
    // command is not used here, we can mute it
    console.log('Preparing release...');
    await this.parseCommitLog(
      await this.getCommitLogs({
        from: String(flags.from),
        to: String(flags.to),
      }),
    );
    console.log(`Analyzing ${chalk.green(this.state.commits.length)} commits...`);
    await this.checkBumps();
    this.generateChangelog();
  }

  computeBumps(packages: string[]) {
    packages.forEach((pkg) => {
      if (this.state.bumps[pkg]) return;
      const commits = this.state.commits.filter((commit) => commit.files.some((file) => file.startsWith(pkg)));
      console.log(`Found ${commits.length} commits for ${pkg}`);
      const isMajor = commits.some((commit) => commit.isBreakingChange);
      const isMinor = commits.some((commit) => commit.type === 'feat');
      const isPatch = commits.some((commit) => commit.type === 'fix');
      const type = isMajor ? 'major' : isMinor ? 'minor' : 'patch';
      const json = this.readJson(`${pkg}/package.json`);
      this.state.bumps[pkg] = {
        root: pkg.split('/')[0],
        name: json.name,
        type: type,
        major: isMajor,
        minor: isMinor,
        patch: isPatch,
        current: json.version,
        new: this.computeNewVersion(json.version, type),
        commits,
        json,
        depsToBump: {},
      };

      console.log(
        `${this.state.bumps[pkg].json.name}: bumping from ${chalk.bold(
          chalk.blue(this.state.bumps[pkg].current),
        )} to ${this.formatVersion(this.state.bumps[pkg].new, this.state.bumps[pkg].type)} [${chalk.bold(
          chalk[
            this.state.bumps[pkg].type === 'major' ? 'red' : this.state.bumps[pkg].type === 'minor' ? 'green' : 'yellow'
          ](this.state.bumps[pkg].type),
        )}]\n`,
      );
    });
  }

  checkDependencies() {
    const packagesKeys = Object.keys(this.state.bumps);
    const packagesNames = packagesKeys.map((pkg) => this.state.bumps[pkg].name);
    packagesKeys.forEach((pkg) => {
      console.log(`${this.state.bumps[pkg].name}: checking dependencies...`);
      const pkgDeps = this.state.bumps[pkg].json.dependencies || {};
      const shouldBump = Object.keys(pkgDeps).filter((dep) => packagesNames.includes(dep));
      if (!shouldBump.length) return;
      shouldBump.forEach((dep) => {
        const depPkg = packagesKeys.find((key) => this.state.bumps[key].name === dep);
        if (!depPkg) return;
        const range = pkgDeps[dep];
        if (!/^[\^~]/.test(range as string)) {
          console.log(`${this.state.bumps[pkg].name}: skipping ${dep} ${range}`);
          return;
        }
        if (String(range).startsWith('~') && this.state.bumps[depPkg].patch) {
          this.state.bumps[pkg].depsToBump[dep] = `~${this.state.bumps[depPkg].new}`;
          console.log(
            `${this.state.bumps[pkg].name}: bumping ${chalk.green(dep)} from ${chalk.bold(
              chalk.blue(range),
            )} to ~${this.formatVersion(this.state.bumps[depPkg].new, this.state.bumps[depPkg].type)}`,
          );
        }
        if (String(range).startsWith('^') && (this.state.bumps[depPkg].minor || this.state.bumps[depPkg].patch)) {
          this.state.bumps[pkg].depsToBump[dep] = `^${this.state.bumps[depPkg].new}`;
          console.log(
            `${this.state.bumps[pkg].name}: bumping ${chalk.green(dep)} from ${chalk.bold(
              chalk.blue(range),
            )} to ^${this.formatVersion(this.state.bumps[depPkg].new, this.state.bumps[depPkg].type)}`,
          );
        }
      });
    });
  }

  computeNewVersion(version: string, type: 'major' | 'minor' | 'patch') {
    const current = version.split('.').map(Number);
    if (type === 'major') {
      current[0]++;
      current[1] = 0;
      current[2] = 0;
    }
    if (type === 'minor') {
      current[1]++;
      current[2] = 0;
    }
    if (type === 'patch') {
      current[2]++;
    }
    return current.join('.');
  }

  async checkBumps() {
    const scanDirectories = this.config('release.scan');
    if (!scanDirectories) {
      console.log('No scan directory configured in ra2.config.json, in release.scan path');
      return;
    }
    console.log(`Scanning for changes in paths:`);
    console.log(scanDirectories.map((dir: string) => `- ${chalk.green(dir.replace(/\/$/, '') + '/*')}`).join('\n'));
    const files = this.state.commits.flatMap((commit) => commit.files);
    const scanFiles = files.filter((file) => {
      // scanDirectories is like ["packages", "apps"]
      // if one of the scanDirectories is in the file path, we include it
      if (scanDirectories.some((dir: string) => file.startsWith(dir))) {
        return true;
      }
      return false;
    });
    console.log(`${scanFiles.length} files changed...`);

    // unique list of packages
    const packages = scanFiles
      .map((file) => [file.split('/')[0], file.split('/')[1]])
      .map((pkg) => pkg.join('/'))
      .filter((value, index, self) => self.indexOf(value) === index);
    console.log(`${packages.length} packages changed...`);
    this.computeBumps(packages);
    this.checkDependencies();
  }

  async parseCommitLog(log: string): Promise<Commit[]> {
    this.state.commits = await Promise.all(
      log
        .split('\n')
        .filter((x) => x)
        .map(async (line) => {
          const [hash, timestamp, ...rest] = line.split(' ');
          const [type] = rest.join(' ').split(':');
          const scope = type.split('(')[1]?.split(')')[0];
          const isBreakingChange = type.includes('!');
          const message = rest.join(' ').split(':').slice(1).join(' ').trim();

          return {
            hash,
            timestamp: new Date(Number(timestamp) * 1000),
            message: message,
            type: type.replace('!', '').replace(`(${scope})`, ''),
            scope,
            isBreakingChange,
            files: (await this.exec(`git diff-tree --no-commit-id --name-only -r ${hash}`))
              .toString()
              .split('\n')
              .filter((x) => x),
          };
        }),
    );
    return this.state.commits;
  }

  async getCommitLogs(flags: { from: string; to: string }) {
    return (await this.exec(`git log --format='%H %ct %s' ${flags.from}..${flags.to}`)).toString();
  }

  formatVersion(version: string, bump: 'major' | 'minor' | 'patch') {
    const [major, minor, patch] = version.split('.').map(Number);
    if (bump === 'major') {
      return chalk.bold(`${chalk.red(`${major}`)}.${chalk.green(`0`)}.${chalk.yellow(`0`)}`);
    } else if (bump === 'minor') {
      return chalk.bold(`${major}.${chalk.green(`${minor}`)}.${chalk.yellow(`0`)}`);
    } else {
      return chalk.bold(`${major}.${minor}.${chalk.yellow(`${patch}`)}`);
    }
  }

  generateChangelog() {
    const config = {
      ...{
        labels: ['autorelease: pending'],
        title: 'chore: release ${version}',
        header: ':robot: I have created a release *beep* *boop*',
        fix: '### Bug Fixes',
        feat: '### Features',
        docs: '### Documentation',
        dependencies: '### Dependencies',
        other: '### Other Changes',
      },
      ...this.config('release.pullRequest'),
    };
    this.state.changelog = `${config.header}
---
`;
    const [year, month, day] = new Date().toISOString().split('T')[0].split('-');
    for (const [pkg, bump] of Object.entries(this.state.bumps)) {
      this.state.changelog += `<details><summary>${pkg}: ${bump.new}</summary>\n\n`;
      this.state.changelog += `## [${bump.new}](https://github.com/${this.config(
        'release.repository',
      )}/compare/${pkg}-v${bump.current}...${pkg}@${bump.new}) (${year}-${month}-${day})\n\n`;

      const commits = {
        feat: bump.commits.filter((commit) => commit.type === 'feat'),
        fix: bump.commits.filter((commit) => commit.type === 'fix'),
        docs: bump.commits.filter((commit) => commit.type === 'docs'),
        other: bump.commits.filter((commit) => !['feat', 'fix', 'docs'].includes(commit.type)),
      };
      Object.keys(commits).forEach((key: string) => {
        if (commits[key as keyof typeof commits].length) {
          this.state.changelog += `${config[key as keyof typeof config]}\n\n`;
          for (const commit of commits[key as keyof typeof commits]) {
            this.state.changelog += `* ${commit.message} ([${commit.hash.slice(0, 7)}](https://github.com/${this.config(
              'release.repository',
            )}/commit/${commit.hash}))\n`;
          }
          this.state.changelog += '\n';
        }
      });

      if (Object.keys(bump.depsToBump).length) {
        this.state.changelog += `${config.dependencies}\n\n`;
        this.state.changelog += '* The following workspace dependencies were updated\n';
        for (const [dep, range] of Object.entries(bump.depsToBump)) {
          this.state.changelog += `    * ${dep} bumped from ${bump.json.dependencies[dep]} to ${range}\n`;
        }
      }

      this.state.changelog += '</details>\n\n';
    }
    console.log(this.state.changelog);
    return this.state.changelog;
  }
}

export default ReleaseCommand;
