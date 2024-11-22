import chalk from 'chalk';
import fs from 'fs';

import { Command } from '../command';
import * as commands from './index';

export class CliCommand extends Command {
  description = 'Entry point for the CLI.';
  options = {
    config: {
      description: 'Path to the configuration file',
      type: 'file',
    },
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
    c: 'config',
    h: 'help',
    v: 'verbose',
  };
  showHelp() {
    console.log('Usage: usdn <command> [options] [args]\n');
    console.log('Commands:');
    for (const [name, cmd] of Object.entries(commands.commands)) {
      console.log(`  ${name}: ${cmd.description}`);
    }
    console.log('\nFlags:');
    for (const [name, { type, description }] of Object.entries(this.options)) {
      const short = Object.entries(this.mappings).find(([_, value]) => value === name)?.[0];

      console.log(
        this.padBetween(
          `  ${short ? `-${short}, ` : ''}--${name}${['file'].includes(type) ? ' = VAL' : ''}`,
          `${description}`,
          40,
        ),
      );
    }

    process.exit(0);
  }

  private cliConfig: Record<string, any> | undefined;

  async parseConfig(flags: Record<string, any>) {
    if (!this.cliConfig) {
      // if there is explicit config file using .json, .ts or .ts, use it
      const shouldGuess =
        flags.config.endsWith('.json') || flags.config.endsWith('.ts') || flags.config.endsWith('.js');
      const configWithOutExt = flags.config.replace(/\.json|\.ts|\.js/g, '');
      // look for potential config file ts,js,json
      const found = [`${configWithOutExt}.ts`, `${configWithOutExt}.js`, `${configWithOutExt}.json`].find((f) =>
        fs.existsSync(f),
      );

      const configPath = shouldGuess == false ? (fs.existsSync(flags.config) ? flags.config : found) : found;
      if (configPath) {
        if (configPath.endsWith('.ts') || configPath.endsWith('.js')) {
          const config = await import(`${process.cwd()}/${configPath}`);
          return config.default;
        }
        this.cliConfig = this.readJson(configPath);
      }
      if (!this.cliConfig) {
        return;
      }
    }
    return this.cliConfig;
  }

  async execute(inputs: string[]) {
    const { command, flags, args } = this.parseInputs(inputs, true);
    if (flags.config) {
      await this.parseConfig(flags);
      console.log('Using config file:', chalk.blue(flags.config));
    }
    if (flags.help || !command) {
      this.showHelp();
    }

    const cmd = commands.commands[command as keyof typeof commands.commands];
    if (!cmd) {
      console.error(`Error: Unknown command "${command}"`);
      this.showHelp();
    }
    try {
      const commandConfig = await this.parseConfig(flags);
      await new cmd(commandConfig).execute(args);
    } catch (error) {
      console.error(`Error: ${error?.message || error}`);
      process.exit(1);
    }
  }
}
