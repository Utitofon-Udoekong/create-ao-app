# create-ao-app 
![NPM License](https://img.shields.io/npm/l/create-ao-app)

A CLI tool for quickly scaffolding AO-powered applications with Next.js or Nuxt.js.

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

# Using the create alias
cao create my-app
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

```bash
# Start AO processes
cao ao:start
cao ao:start -n "my-process"

# Monitor AO processes
cao ao:monitor
cao ao:monitor -p "pattern-to-match"
cao ao:monitor --json

# Evaluate AO processes
cao ao:eval "your-input"
cao ao:eval "your-input" --await
cao ao:eval "your-input" --timeout 10000

# Schedule AO processes
cao ao:schedule -i 5000 -t "tickFunction"
cao ao:schedule-stop
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
cao ao:generate -p "Create a counter contract" --provider anthropic --model claude-3-5-sonnet-latest
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
autoStart: false         # Auto-start AO processes
ports:
  dev: 3000             # Development server port
processName: 'my-process' # Custom AO process name
```

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

## Troubleshooting

### Common Issues

1. **Command Not Found**
```bash
# Ensure global installation
pnpm add -g create-ao-app

# Or fix npm global permissions
sudo chown -R $USER /usr/local/lib/node_modules
```

2. **AOS Not Installed**
```bash
# Install AOS CLI
npm install -g @permaweb/aos-cli
```

3. **Development Server Issues**
```bash
# Check if port is in use
lsof -i :3000
# Kill process if needed
kill -9 <PID>
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

### Command Options

| Command         | Option                          | Description                                      |
|-----------------|---------------------------------|--------------------------------------------------|
| `ao:start`      | `-n, --process-name <name>`    | Set custom name for AO process                  |
|                 | `-m, --monitor-process`        | Monitor process after starting                   |
|                 | `-e, --evaluate <input>`       | Evaluate process after starting                  |
|                 | `--config-path <path>`         | Custom config file path                          |
| `ao:monitor`    | `-p, --pattern [pattern]`      | Message pattern to match                         |
|                 | `--json`                       | Output in JSON format                            |
| `ao:eval`       | `<input>`                      | Input for evaluating the AO process              |
|                 | `--await`                      | Wait for response                                |
|                 | `--timeout <ms>`               | Timeout in milliseconds, default is 5000        |
| `ao:schedule`   | `-i, --interval <ms>`          | Scheduler interval, default is 1000             |
|                 | `-t, --tick <function>`        | Tick function name                               |
| `ao:schedule-stop` |                               | Stop the process scheduler                       |
| `config`        | `--get <key>`                  | Get configuration value                          |
|                 | `--set <key> <value>`          | Set configuration value                          |
|                 | `--delete <key>`               | Delete configuration value                       |
| `dev`           | `--config-path <path>`         | Path to configuration file                       |
| `dev:ao`        | `-m, --monitor-process`        | Monitor AO processes after starting              |
|                 | `-e, --evaluate <input>`       | Evaluate process after starting                  |
|                 | `--config-path <path>`         | Custom config file path                          |
| `init`          | `-f, --framework <framework>`  | Framework to use (nextjs or nuxtjs)            |
|                 | `-p, --path <path>`            | Path to create the project in                   |
|                 | `--package-manager <pm>`       | Package manager to use (npm, yarn, pnpm)       |
| `ao:generate`   | `-p, --prompt <text>`          | Description of the Lua code you want to generate |
|                 | `-t, --type <type>`            | Type of code (contract/module/test)             |
|                 | `-o, --output <path>`          | Output file path                                |
|                 | `--provider <provider>`         | AI provider to use (openai or anthropic)       |
|                 | `--model <model>`              | Specific AI model to use                        |