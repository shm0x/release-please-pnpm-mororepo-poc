import { Command } from '../command';

export class InitCommand extends Command {
  static description = 'Configure USDN stack';
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
    const { command, flags, args } = this.formatInputs(inputs);
  }
}

export default InitCommand;
