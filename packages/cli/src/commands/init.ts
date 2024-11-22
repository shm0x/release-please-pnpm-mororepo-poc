import { Command } from '../command';

export class InitCommand extends Command {
  static description = 'Configure USDN stack on your machine';
  options = {
    help: {
      description: 'Show this help message',
      type: 'boolean',
    },
    verbose: {
      description: 'Enable debug mode',
      type: 'boolean',
    },
  };
  mappings = {
    h: 'help',
    v: 'verbose',
  };
  async execute(inputs: string[]) {
    const { command, flags, args } = this.parseInputs(inputs);
  }
}

export default InitCommand;
