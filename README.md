# create-ao-app

![NPM License](https://img.shields.io/npm/l/create-ao-app)

"Create-ao-app: Your AI-powered CLI companion for building, managing, and deploying AO smart contracts with Next.js and Nuxt.js integration."

## Features

- 🚀 Quick project scaffolding
- 🔄 Multiple framework support (Next.js, Nuxt.js)
- 📦 Automatic dependency installation
- 🎯 Git repository initialization
- 💻 Interactive CLI interface
- ⚡️ Built with TypeScript
- 🔧 AO Process Management
- 🖥️ Development Server Integration
- 🤖 AI-Powered Code Generation

## Built with

TypeScript, Node.js, Commander, Inquirer, OpenAI API, Anthropic API, fs-extra, ora, chalk, Jest, pnpm

## Installation

```bash
# Using npm
npm install -g create-ao-app

# Using pnpm (recommended)
pnpm add -g create-ao-app

# Or use directly with npx
npx create-ao-app init my-app
```

## Usage

The CLI can be accessed using either `create-ao-app` or the shorter alias `cao`.

### Creating a New Project

```bash
# Interactive mode (recommended)
cao init my-app

# Specify framework
cao init my-app --framework nextjs

# Use in existing directory
cao init --path ./existing-directory

# Specify package manager
cao init my-app --package-manager pnpm
```

### Development Commands

```bash
# Start development server only
cao dev

# Start both development server and AO processes
cao dev:ao

# Start development server with monitoring
cao dev:ao -m

# Start with process evaluation
cao dev:ao -e "your-eval-input"
```

### AO Process Management

AO processes run on the Arweave network and can be managed using the following commands:

```bash
# Start an AO process
cao ao:start                              # Start with default name
cao ao:start -n "my-process"              # Start with custom name
cao ao:start -w "./wallet.json"           # Use specific wallet
cao ao:start --tag-name "type" --tag-value "counter"  # Add tags
cao ao:start --module <txid>              # Use specific module
cao ao:start --cron "1-minute"            # Setup with cron job
cao ao:start --sqlite                     # Use SQLite module
cao ao:start --monitor                    # Start with monitoring

# Monitor processes
cao ao:monitor                            # Monitor default process
cao ao:monitor my-process                 # Monitor specific process

# Watch process output
cao ao:watch my-process                   # Watch specific process

# List processes
cao ao:list                               # List all processes for your wallet

# Setup cron jobs
cao ao:cron my-process "1-minute"         # Setup minute cron
cao ao:cron my-process "30-second"        # Setup second cron
```

### AI Code Generation

Before using the AI code generation feature, you need to configure an API key. You have several options:

1. Set environment variable:

```bash
export OPENAI_API_KEY='your-api-key-here'
export ANTHROPIC_API_KEY='your-anthropic-api-key-here'
```

2. Configure API key through CLI:

```bash
cao config:api
```

3. The CLI will prompt for an API key if none is found when running generation commands.

Generate code:

```bash
# Generate a Lua contract
cao ao:generate -p "Create a simple counter contract" -t contract -o ./ao/counter.lua

# Generate a test module
cao ao:generate -p "Create tests for counter contract" -t test -o ./ao/tests/counter.test.lua

# Generate without saving to file
cao ao:generate -p "Create a token contract"

# Specify AI provider and model
cao ao:generate -p "Create a counter contract" --provider openai --model gpt-4
cao ao:generate -p "Create a counter contract" --provider anthropic --model claude-3-opus-20240229
```

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

```yaml
luaFiles: []              # Lua files to load
packageManager: 'pnpm'    # npm, yarn, or pnpm
framework: 'nextjs'       # nextjs or nuxtjs
processName: 'my-process' # Default process name
ports:
  dev: 3000             # Development server port
```

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
git clone https://github.com/Utitofon-Udoekong/create-ao-app.git
cd create-ao-app

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link for local testing
pnpm run link:global

# Test the CLI
cao init test-app

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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details

## Support

For support, please [open an issue](https://github.com/Utitofon-Udoekong/create-ao-app/issues) on GitHub.
