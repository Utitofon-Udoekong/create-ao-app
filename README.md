# AO-Forge

_Repo metadata_

[![GitHub tag](https://img.shields.io/github/tag/Utitofon-Udoekong/aoforge-cli?include_prereleases=&sort=semver&color=blue)](https://github.com/Utitofon-Udoekong/aoforge-cli/releases/)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)
[![NPM License](https://img.shields.io/npm/l/ao-forge)](https://www.npmjs.com/package/ao-forge)

"🔥 AO-Forge: Your AI-powered CLI companion for building, managing, and deploying AO smart contracts with Next.js, Nuxt.js, and Svelte integration."

## Documentation

<div align="center">

[![view - Documentation](https://img.shields.io/badge/view-Documentation-blue?style=for-the-badge)](https://aoforge_arlink.arweave.net/ "Go to project documentation")

</div>

- **[Quick Start Guide](docs/QUICK_START.md)** — Get up and running in minutes
- **[CLI Reference](docs/CLI_REFERENCE.md)** — Complete command documentation and options


## Features

- 🚀 Quick project scaffolding
- 🔄 Multiple framework support (Next.js, Nuxt.js, Svelte)
- 📦 Automatic dependency installation
- 🎯 Git repository initialization
- 💻 Interactive CLI interface
- ⚡️ Built with TypeScript
- 🖥️ Development Server Integration
- 🤖 AI-Powered Code Generation
- 🔨 Simple Build System
- ⚙️ Configuration Management
- 🔧 AO Process Management

## Built with

TypeScript, Node.js, Commander, Inquirer, OpenAI API, Anthropic API, fs-extra, ora, chalk, Jest, pnpm

## Installation

```bash
# Using npm
npm install -g ao-forge

# Using pnpm (recommended)
pnpm add -g ao-forge

# Or use directly with npx

npx ao-forge init my-app

```

## Quick Start


See the [Quick Start Guide](docs/QUICK_START.md) for step-by-step instructions.

## CLI Usage

See the [CLI Reference](docs/CLI_REFERENCE.md) for all commands, options, and advanced usage.


## AI-Powered Development

Forge includes advanced AI capabilities for AO development. See the [AI Commands section](docs/CLI_REFERENCE.md#ai-commands) in the CLI Reference for details and examples.

## Plugin System

Forge supports a plugin system for extending functionality. See [Plugins](docs/CLI_REFERENCE.md#plugin-commands).

## Project Structure

```
my-app/
├── README.md
├── node_modules/
├── package.json
├── ao.config.yml      # AO configuration file
├── tsconfig.json
└── [framework-specific-files]
├── ao/               # For Nuxt.js projects
│   └── *.lua
└── src/             # For Next.js projects
    └── ao/
        └── *.lua
```

## Configuration (ao.config.yml)


The configuration file is now fully documented in the [CLI Reference](docs/CLI_REFERENCE.md#configuration-file-ao-config-yml). Use the provided template as a starting point.

---

## Command Options

| Command      | Option                    | Description                                    |
|--------------|---------------------------|------------------------------------------------|
| `ao:start`   | `-n, --name <name>`      | Name for the AO process                       |
|              | `-w, --wallet <path>`     | Path to wallet file                           |
|              | `-d, --data <path>`       | Data file path                                |
|              | `--tag-name <name>`       | Process tag name                              |
|              | `--tag-value <value>`     | Process tag value                             |
|              | `--module <txid>`         | Module ID to use                              |
|              | `--cron <frequency>`      | Setup cron job (e.g., "1-minute")            |
|              | `--monitor`               | Monitor the process                           |
|              | `--sqlite`                | Use sqlite3 AOS Module                        |
|              | `--gateway-url <url>`     | Set Arweave gateway URL                      |
|              | `--cu-url <url>`          | Set Computer Unit URL                         |
|              | `--mu-url <url>`          | Set Messenger Unit URL                        |
| `ao:monitor` | `[name]`                  | Process name to monitor                       |
| `ao:watch`   | `<name>`                  | Process name to watch                         |
| `ao:list`    |                          | List processes for your wallet                |
| `ao:cron`    | `<name>`                  | Process name                                  |
|              | `<frequency>`             | Cron frequency (e.g., "1-minute")            |
| `init`       | `-f, --framework`         | Framework to use (nextjs or nuxtjs)          |
|              | `-p, --path`              | Path to create project                        |
|              | `--package-manager`       | Package manager (npm, yarn, pnpm)            |
| `dev:ao`     | `-n, --name <name>`      | Name for the AO process                       |
|              | `--monitor`               | Monitor process after starting                |
| `ao:generate`| `-p, --prompt <text>`     | Description of code to generate              |
|              | `-t, --type <type>`       | Type of code (contract/module/test)          |
|              | `-o, --output <path>`     | Output file path                             |
|              | `--provider <provider>`   | AI provider (openai/anthropic)               |
|              | `--model <model>`         | Specific AI model to use                     |

## Development

```bash
# Clone the repository
git clone https://github.com/Utitofon-Udoekong/aoforge-cli.git
cd aoforge-cli

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link for local testing
pnpm run link:global

# Test the CLI
ao-forge init test-app

# Unlink when done
pnpm run unlink:global
```

### Development Scripts

```bash
pnpm dev           # Watch mode
pnpm build         # Build project
pnpm test:cli      # Test CLI directly
pnpm link:global   # Link globally
pnpm unlink:global # Unlink global installation
```


### Running AO Processes

You can manage AO processes using Forge commands or the AOS CLI directly:

```bash
# Using ao-forge commands
ao-forge process start -n "my-process"
ao-forge process stop
ao-forge process list

# Or use AOS CLI directly
npm i -g https://get_ao.g8way.io
aos [process-name] --load ./ao/contract.lua
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Released under [MIT](/LICENSE) by [@Utitofon-Udoekong](https://github.com/Utitofon-Udoekong).

## Support

For support, please [open an issue](https://github.com/Utitofon-Udoekong/aoforge-cli/issues) on GitHub.
