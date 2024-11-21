import { Command } from '../command';
import * as commands from './index';

export class CliCommand extends Command {
  description = 'Entry point for the CLI.';
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
    const { command, flags, args } = this.formatInputs(inputs, true);
    if (flags.help) {
      console.log('Usage: usdn <command> [options] [args]\n');
      console.log('Commands:');
      for (const [name, cmd] of Object.entries(commands.commands)) {
        console.log(`  ${name}: ${cmd.description}`);
      }
      console.log('\nFlags:');
      for (const [name, { description }] of Object.entries(this.options)) {
        const short = Object.entries(this.mappings).find(([_, value]) => value === name)?.[0];
        console.log(
          `  ${short ? `-${short}, ` : ''}--${name}\t\t${
            !short || name.length > 4 || name.length == 4 ? `\t` : ''
          }${description}`,
        );
      }
      process.exit(0);
    }

    const cmd = commands.commands[command];
    if (!cmd) {
      console.error(`Error: Unknown command "${command}"`);
      process.exit(1);
    }
    try {
      await new cmd().execute(args);
    } catch (error) {
      console.error(`Error: ${error?.message || error}`);
      process.exit(1);
    }
  }
}
