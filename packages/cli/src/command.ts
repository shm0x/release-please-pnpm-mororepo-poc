import { execSync } from 'child_process';
import defu from 'defu';
import fs from 'fs';
export abstract class Command {
  mappings: Record<string, string> = {};
  options: Record<string, { description: string; type: string; multiple?: boolean }> = {};
  abstract execute(inputs: string[]): Promise<void> | void;
  constructor(protected _config: Record<string, any> | undefined = {}) {}
  getMappedOption(opt: string) {
    return this.mappings[opt] || opt;
  }

  extractInput(arg: string, nextArg: string): { name: string; value: string | boolean; shift: boolean } {
    const name = this.getMappedOption(arg);
    let value: string | boolean = false;
    let shift = false;

    if (arg.includes('=')) {
      const [name_, value_] = arg.split('=');
      return {
        name: this.getMappedOption(name_),
        value: ['false', 'true'].includes(value_) ? value_ === 'true' : value_,
        shift,
      };
    }
    if (this.options[this.getMappedOption(arg)]?.type === 'boolean') {
      return { name, value: true, shift };
    } else if (nextArg && !nextArg.startsWith('-')) {
      value = ['false', 'true'].includes(nextArg) ? nextArg === 'true' : nextArg;
      shift = true;
    }
    return { name, value, shift };
  }

  padBetween(left: string, right: string, padding = 30) {
    return left.padEnd(padding, ' ') + right.trim();
  }

  parseInputs(inputs: string[], stopCommand = false): Inputs {
    let command = undefined;
    const args: string[] = [];
    const flags: Record<string, [boolean | string]> = {};

    for (let i = 0; i < inputs.length; i++) {
      if (stopCommand && command) {
        args.push(...inputs.slice(i));
        break;
      }
      const arg = inputs[i];
      const isOption = arg.startsWith('--');
      const isShortOption = arg.startsWith('-') && !isOption;
      if (isOption || isShortOption) {
        const flag = arg.slice(isOption ? 2 : 1);
        const { name, value, shift } = this.extractInput(flag, inputs[i + 1]);
        if (shift) i++;
        flags[name] = flags[name] || [];
        flags[name].push(value);
      } else if (!command) {
        command = arg;
      } else {
        args.push(arg);
      }
    }

    return {
      command,
      flags: Object.entries(flags).reduce(
        (acc, [key, value]) => {
          if (!this.options[key]?.multiple) {
            acc[key] = value[value.length - 1];
          } else {
            acc[key] = value as string[];
          }
          return acc;
        },
        {} as Record<string, boolean | string | string[]>,
      ),
      args,
    };
  }

  async exec(command: string) {
    return execSync(command);
  }

  readJson(path: string) {
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  }

  config(key: string) {
    // use dot notation to access nested properties
    return key.split('.').reduce((acc, k) => acc[k], this._config || {});
  }

  mergeConfig(config: Record<string, any>, key: string) {
    const final = defu(config, this.config(key));
    return key.split('.').reduce((acc, k, i, arr) => {
      if (i === arr.length - 1) {
        acc[k] = final;
        return acc;
      }
      acc[k] = acc[k] || {};
      return acc[k];
    }, this._config || {});
  }
}

export type Inputs = {
  command?: string;
  flags: Record<string, boolean | string | string[]>;
  args: string[];
};
