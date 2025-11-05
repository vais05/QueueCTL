import chalk from 'chalk';
import { getConfigValue, setConfigValue, getAllConfigValues } from '../core/config.js';
import { table } from 'table';

export function configCommand(action, options) {
  if (action === 'set') {
    const { key, value } = options;

    if (!key || !value) {
      console.error(chalk.red('✗ Both key and value are required'));
      process.exit(1);
    }

    setConfigValue(key, value);
    console.log(chalk.green('✓ Configuration updated'));
    console.log(`  ${chalk.cyan(key)} = ${chalk.yellow(value)}`);
  } else if (action === 'get') {
    const key = options.key;

    if (key) {
      const value = getConfigValue(key);
      if (value === null) {
        console.log(chalk.yellow(`Config key not found: ${key}`));
        return;
      }
      console.log(`${chalk.cyan(key)} = ${chalk.yellow(value)}`);
    } else {
      const configs = getAllConfigValues();

      if (configs.length === 0) {
        console.log(chalk.yellow('No configuration found'));
        return;
      }

      const data = [
        [chalk.bold('Key'), chalk.bold('Value')],
        ...configs.map(config => [
          chalk.cyan(config.key),
          chalk.yellow(config.value),
        ]),
      ];

      console.log(chalk.bold.cyan('\\n⚙️  Configuration\\n'));
      console.log(table(data));
    }
  }
}