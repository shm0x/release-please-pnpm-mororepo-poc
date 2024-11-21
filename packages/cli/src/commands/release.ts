import { Command } from '../command';

export class ReleaseCommand extends Command {
  static description = 'Prepare a new release';
  options = {
    help: {
      description: 'Show this help message',
      type: 'boolean',
    },
    verbose: {
      description: 'Enable debug mode',
      type: 'boolean',
    },
    from: {
      description: 'Start commit',
      type: 'string',
    },
    to: {
      description: 'End commit',
      type: 'string',
    },
  };
  mappings = {
    h: 'help',
    v: 'verbose',
  };
  async execute(inputs: string[]) {
    const { command, flags, args } = this.formatInputs(inputs);
    const stdout = (await this.exec(`git log --format='%H %ct %s' ${flags.from}..${flags.to}`)).toString();
    const commits = await Promise.all(
      stdout
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

    const bumps = {};
    for (const commit of commits) {
      for (const file of commit.files) {
        const pkg = file.split('/')[1];
        if (!pkg) continue;
        if (!bumps[pkg]) {
          const json = this.readJson(`packages/${pkg}/package.json`);
          bumps[pkg] = {
            major: false,
            minor: false,
            patch: false,
            current: json.version,
            commits: [],
            json,
          };
        }
        if (!bumps[pkg].commits.includes(commit)) {
          bumps[pkg].commits.push(commit);
        }
        if (commit.isBreakingChange) {
          bumps[pkg].major = true;
          bumps[pkg].minor = false;
          bumps[pkg].patch = false;
          continue;
        }
        if (commit.type === 'feat' && !bumps[pkg].major) {
          bumps[pkg].minor = true;
          bumps[pkg].patch = false;
          continue;
        }
        if (commit.type === 'fix' && !bumps[pkg].major && !bumps[pkg].minor) {
          bumps[pkg].patch = true;
          continue;
        }
      }
    }

    const packages = Object.values(bumps).map((pkg) => pkg.json.name);
    console.log(`Found changes in packages: ${packages.join(', ')}`);

    // For each package, compute the new version based on the bump type
    for (const [pkg, bump] of Object.entries(bumps)) {
      const version = bump.json.version.split('.').map(Number);
      if (bump.major) {
        version[0]++;
        version[1] = 0;
        version[2] = 0;
      } else if (bump.minor) {
        version[1]++;
        version[2] = 0;
      } else if (bump.patch) {
        version[2]++;
      }
      bump.new = version.join('.');
      bump.depsToBump = {};
      // now, for each internal dependency that was bumped, we need to update the version in the package.json
      // For example, if the config packages was update, and app depends on it, we need to check the @usdn/config version in app's package.json
      // and check if semver allow bump
      for (const [dep, range] of Object.entries(bump.json.dependencies || {})) {
        console.log(dep, range);

        if (packages.includes(dep)) {
          console.log('Found internal dependency', dep);
          const depPkg = dep.split('/')[1];
          if (bumps[depPkg]) {
            // If the range dont start with ^ or ~, we dont update it
            if (!/^[\^~]/.test(range)) {
              continue;
            }
            // if tilde, we only allow update the patch
            if (range.startsWith('~') && bumps[depPkg].patch) {
              bump.depsToBump[dep] = `~${bumps[depPkg].new}`;
            }
            if (range.startsWith('^') && (bumps[depPkg].minor || bumps[depPkg].patch)) {
              // if caret, we allow update the minor and patch
              bump.depsToBump[dep] = `^${bumps[depPkg].new}`;
            }
          }
        }
      }
    }

    const PRContent = this.generatePRContent(bumps);
    console.log(PRContent);
  }

  generatePRContent(bumps) {
    //<details><summary>config: 5.1.0</summary>

    //## [5.1.0](https://github.com/Backend-RA2-Tech/usdn-backend/compare/config-v5.0.1...config@5.1.0) (2024-11-19)

    //### Features

    //* apply suggestions ([6666db2](https://github.com/Backend-RA2-Tech/usdn-backend/commit/6666db24b3acac95211df744ea02266f5ab164ab))

    //### Bug Fixes

    //* bump all packages patch ([eee5f07](https://github.com/Backend-RA2-Tech/usdn-backend/commit/eee5f0717d42af01a0963ad5874c591c703eaf0f))
    //* trigger bump versions ([be6d18f](https://github.com/Backend-RA2-Tech/usdn-backend/commit/be6d18f620b47c951ad4653c53f5690e62853352))

    //### Dependencies

    //* The following workspace dependencies were updated
    //  * dependencies
    //    * @usdn/config bumped from ~5.0.0 to ~5.1.0
    //    * @usdn/oracle-prices-client bumped from ~2.0.0 to ~2.0.1
    //</details>
    let content = '';
    const [year, month, day] = new Date().toISOString().split('T')[0].split('-');
    console.log(bumps);
    for (const [pkg, bump] of Object.entries(bumps)) {
      content += `<details><summary>${pkg}: ${bump.new}</summary>\n\n`;
      content += `## [${bump.new}](https://github.com/Backend-RA2-Tech/usdn-backend/compare/${pkg}-v${bump.current}...${pkg}@${bump.new}) (${year}-${month}-${day})\n\n`;

      const featCommits = bump.commits.filter((commit) => commit.type === 'feat');

      if (featCommits.length) {
        content += '### Features\n\n';
        for (const commit of featCommits) {
          content += `* ${commit.message} ([${commit.hash.substr(
            0,
            7,
          )}](https://github.com/Backend-RA2-Tech/usdn-backend/commit/${commit.hash}))\n`;
        }
      }
      const fixCommits = bump.commits.filter((commit) => commit.type === 'fix');

      if (fixCommits.length) {
        content += '### Bug Fixes\n\n';
        for (const commit of fixCommits) {
          content += `* ${commit.message} ([${commit.hash.substr(
            0,
            7,
          )}](https://github.com/Backend-RA2-Tech/usdn-backend/commit/${commit.hash}))\n`;
        }
      }

      content += '</details>\n\n';
    }
    return content;
  }
}

export default ReleaseCommand;
