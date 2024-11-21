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
    console.log('Release command', { command, flags, args });
    const stdout = (await this.exec(`git log --format='%H %s' ${flags.from}..${flags.to}`)).toString();
    const commits = stdout
      .split('\n')
      .filter((x) => x)
      .map((line) => {
        const [hash, ...rest] = line.split(' ');
        const [type] = rest.join(' ').split(':');
        const isBreakingChange = type.includes('!');
        const message = rest.join(' ').split(':').slice(1).join(' ').trim();

        return { hash, message: message, type: type.replace('!', ''), isBreakingChange };
      });
    console.log('Commits:', commits);
  }
}

export default ReleaseCommand;
