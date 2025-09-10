# Forge CLI Reference

## Overview

Forge is a comprehensive CLI tool for building, managing, and deploying AO smart contracts with AI-powered code generation capabilities.

## Commands

### `forge ai` - AI-Powered Code Generation

The AI command provides comprehensive code generation, analysis, and optimization for AO smart contracts.

#### Basic Usage

```bash
# Generate code from prompt
forge ai --prompt "Create a counter contract"

# Generate from template
forge ai --template counter --output counter.lua

# Start interactive session
forge ai --interactive
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `-p, --prompt <text>` | Generate code from text prompt | `--prompt "Create a token contract"` |
| `-f, --file <path>` | Target file for operations | `--file contract.lua` |
| `-i, --interactive` | Start interactive AI session | `--interactive` |
| `--refactor` | Refactor existing code | `--file contract.lua --refactor` |
| `--test` | Generate tests for file | `--file contract.lua --test` |
| `--analyze` | Analyze code quality | `--file contract.lua --analyze` |
| `--template <name>` | Generate from template | `--template counter` |
| `--optimize <type>` | Optimize code | `--optimize performance` |
| `--document <format>` | Generate documentation | `--document markdown` |
| `--audit` | Perform security audit | `--audit` |
| `--batch <operation>` | Batch process files | `--batch analyze` |
| `--migrate <framework>` | Generate migration script | `--migrate aos-2.0` |
| `--integration-tests <type>` | Generate integration tests | `--integration-tests api` |
| `-o, --output <path>` | Output file path | `--output generated.lua` |
| `--provider <name>` | AI provider | `--provider anthropic` |
| `--model <name>` | AI model to use | `--model claude-3-opus-latest` |
| `--temperature <number>` | AI temperature (0.0-1.0) | `--temperature 0.7` |

#### Advanced Features

**Code Optimization:**
```bash
# Optimize for performance
forge ai --file contract.lua --optimize performance

# Optimize for security
forge ai --file contract.lua --optimize security

# Optimize for readability
forge ai --file contract.lua --optimize readability
```

**Documentation Generation:**
```bash
# Generate markdown documentation
forge ai --file contract.lua --document markdown

# Generate HTML documentation
forge ai --file contract.lua --document html

# Generate JSON documentation
forge ai --file contract.lua --document json
```

**Security Auditing:**
```bash
# Perform comprehensive security audit
forge ai --file contract.lua --audit
```

**Batch Processing:**
```bash
# Analyze multiple files
forge ai --file "file1.lua,file2.lua,file3.lua" --batch analyze

# Optimize multiple files
forge ai --file "*.lua" --batch optimize

# Generate documentation for multiple files
forge ai --file "contracts/*.lua" --batch document
```

**Migration Scripts:**
```bash
# Generate migration to AOS 2.0
forge ai --file contract.lua --migrate aos-2.0

# Generate migration to new framework
forge ai --file contract.lua --migrate new-framework
```

**Integration Tests:**
```bash
# Generate API integration tests
forge ai --file contract.lua --integration-tests api

# Generate database integration tests
forge ai --file contract.lua --integration-tests database

# Generate external integration tests
forge ai --file contract.lua --integration-tests external
```

#### Available Templates

- **counter** - Simple counter with increment/decrement
- **token** - Basic token with transfer functionality
- **nft** - Non-fungible token implementation
- **dao** - Decentralized autonomous organization
- **marketplace** - Decentralized marketplace
- **oracle** - Price oracle for external data
- **multisig** - Multi-signature wallet
- **lending** - Decentralized lending protocol

#### AI Providers & Models

**OpenAI Models:**
- `gpt-4o-mini` (default) - Fast and cost-effective
- `gpt-4o` - More capable for complex tasks
- `gpt-3.5-turbo` - Legacy model

**Anthropic Models:**
- `claude-3-5-sonnet-latest` (default) - Balanced performance
- `claude-3-5-haiku-latest` - Fast and efficient
- `claude-3-opus-latest` - Most capable

#### Interactive Session

Start an interactive AI coding session:

```bash
forge ai --interactive
```

**Interactive Commands:**
- `help` - Show available commands
- `generate <prompt>` - Generate code from prompt
- `refactor <file>` - Refactor existing code
- `analyze <file>` - Analyze code quality
- `optimize <file> <type>` - Optimize for performance/security/readability
- `document <file> <format>` - Generate documentation (markdown/html/json)
- `audit <file>` - Perform security audit
- `template <name>` - Generate from template
- `migrate <file> <target>` - Generate migration script
- `tests <file> <type>` - Generate integration tests
- `context <new-context>` - Set conversation context
- `clear` - Clear conversation history
- `exit` - Exit session

### `forge init` - Project Initialization

Initialize a new AO project with framework support.

```bash
# Interactive mode (recommended)
forge init my-app

# Specify framework
forge init my-app --framework nextjs

# Use in existing directory
forge init --path ./existing-directory

# Specify package manager
forge init my-app --package-manager pnpm
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `-f, --framework` | Framework to use | `--framework nextjs` |
| `-p, --path` | Path to create project | `--path ./my-app` |
| `--package-manager` | Package manager | `--package-manager pnpm` |

### `forge dev` - Development Server

Start the development server.

```bash
# Start development server only
forge dev

# Start with AO processes
forge dev:ao

# Start with monitoring
forge dev:ao -m
```

### `forge build` - Build Project

Build the project for production.

```bash
# Build project
forge build

# Build with specific configuration
forge build --config production
```

### `forge deploy` - Deploy Project

Deploy the project to production.

```bash
# Deploy project
forge deploy

# Deploy with specific environment
forge deploy --env production
```

### `forge ao:start` - Start AO Process

Start an AO process on the Arweave network.

```bash
# Start with default name
forge ao:start

# Start with custom name
forge ao:start -n "my-process"

# Use specific wallet
forge ao:start -w "./wallet.json"

# Add tags
forge ao:start --tag-name "type" --tag-value "counter"

# Use specific module
forge ao:start --module <txid>

# Setup with cron job
forge ao:start --cron "1-minute"

# Use SQLite module
forge ao:start --sqlite

# Start with monitoring
forge ao:start --monitor
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `-n, --name <name>` | Name for the AO process | `--name my-process` |
| `-w, --wallet <path>` | Path to wallet file | `--wallet ./wallet.json` |
| `-d, --data <path>` | Data file path | `--data ./data.json` |
| `--tag-name <name>` | Process tag name | `--tag-name type` |
| `--tag-value <value>` | Process tag value | `--tag-value counter` |
| `--module <txid>` | Module ID to use | `--module abc123` |
| `--cron <frequency>` | Setup cron job | `--cron "1-minute"` |
| `--monitor` | Monitor the process | `--monitor` |
| `--sqlite` | Use sqlite3 AOS Module | `--sqlite` |
| `--gateway-url <url>` | Set Arweave gateway URL | `--gateway-url https://arweave.net` |
| `--cu-url <url>` | Set Computer Unit URL | `--cu-url https://cu.ao-testnet.xyz` |
| `--mu-url <url>` | Set Messenger Unit URL | `--mu-url https://mu.ao-testnet.xyz` |

### `forge ao:monitor` - Monitor AO Process

Monitor an AO process.

```bash
# Monitor default process
forge ao:monitor

# Monitor specific process
forge ao:monitor my-process
```

### `forge ao:watch` - Watch AO Process

Watch process output in real-time.

```bash
# Watch specific process
forge ao:watch my-process
```

### `forge ao:list` - List AO Processes

List all processes for your wallet.

```bash
# List all processes
forge ao:list
```

### `forge ao:cron` - Setup Cron Jobs

Setup cron jobs for AO processes.

```bash
# Setup minute cron
forge ao:cron my-process "1-minute"

# Setup second cron
forge ao:cron my-process "30-second"
```

### `forge config` - Configuration Management

Manage configuration settings.

```bash
# Set configuration value
forge config set ai.openai_key 'your-key'

# Get configuration value
forge config get ai.openai_key

# List all configuration
forge config list

# Reset configuration
forge config reset
```

### `forge plugin` - Plugin Management

Manage plugins for extending functionality.

```bash
# Install plugin
forge plugin install <plugin-name>

# Uninstall plugin
forge plugin uninstall <plugin-name>

# List installed plugins
forge plugin list

# Enable plugin
forge plugin enable <plugin-name>

# Disable plugin
forge plugin disable <plugin-name>

# Search plugins
forge plugin search <query>

# Update plugin
forge plugin update <plugin-name>
```

## Configuration

### Environment Variables

```bash
# AI API Keys
export OPENAI_API_KEY='your-openai-api-key'
export ANTHROPIC_API_KEY='your-anthropic-api-key'

# AO Configuration
export AO_WALLET_PATH='./wallet.json'
export AO_GATEWAY_URL='https://arweave.net'
export AO_CU_URL='https://cu.ao-testnet.xyz'
export AO_MU_URL='https://mu.ao-testnet.xyz'
```

### Configuration File (ao.config.yml)

```yaml
# Project configuration
luaFiles: []              # Lua files to load
packageManager: 'pnpm'    # npm, yarn, or pnpm
framework: 'nextjs'       # nextjs, nuxtjs, or svelte
processName: 'my-process' # Default process name

# Development ports
ports:
  dev: 3000             # Development server port
  build: 3001           # Build server port

# AO configuration
aos:
  version: '2.x'        # AOS version
  features:
    coroutines: true    # Enable coroutines
    bootloader: false   # Enable bootloader
    weavedrive: false   # Enable weavedrive

# AI configuration
ai:
  default_provider: 'openai'
  default_model: 'gpt-4o-mini'
  temperature: 0.7
  max_tokens: 4000

# Plugin configuration
plugins:
  enabled: []
  disabled: []
```

## Examples

### Complete Workflow Example

```bash
# 1. Initialize new project
forge init my-dao --framework nextjs --package-manager pnpm

# 2. Navigate to project
cd my-dao

# 3. Generate DAO contract using AI
forge ai --template dao --output ao/dao.lua

# 4. Generate tests for the contract
forge ai --file ao/dao.lua --test --output ao/tests/dao.test.lua

# 5. Analyze the contract
forge ai --file ao/dao.lua --analyze

# 6. Optimize for security
forge ai --file ao/dao.lua --optimize security

# 7. Generate documentation
forge ai --file ao/dao.lua --document markdown --output docs/dao.md

# 8. Start development server
forge dev

# 9. Deploy AO process
forge ao:start -n "my-dao" --tag-name "type" --tag-value "dao" --monitor
```

### Interactive AI Session Example

```bash
# Start interactive session
forge ai --interactive

# In the session:
> generate Create a simple counter contract
> analyze counter.lua
> optimize counter.lua performance
> document counter.lua markdown
> audit counter.lua
> exit
```

## Troubleshooting

### Common Issues

1. **AI API Key Not Found**
   ```bash
   # Set environment variable
   export OPENAI_API_KEY='your-key'
   
   # Or configure through CLI
   forge config set ai.openai_key 'your-key'
   ```

2. **AO Process Not Starting**
   ```bash
   # Check wallet file
   ls -la wallet.json
   
   # Check network connectivity
   curl https://arweave.net/status
   ```

3. **Build Failures**
   ```bash
   # Clear cache and reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

### Debug Mode

Enable debug logging:

```bash
# Set debug level
export FORGE_LOG_LEVEL=debug

# Or use debug flag
forge ai --prompt "test" --debug
```

## Support

For more information and support:

- **Documentation**: [https://docs.forge-ao.com](https://docs.forge-ao.com)
- **GitHub**: [https://github.com/forge-ao/forge](https://github.com/forge-ao/forge)
- **Discord**: [https://discord.gg/forge-ao](https://discord.gg/forge-ao)
- **Issues**: [https://github.com/forge-ao/forge/issues](https://github.com/forge-ao/forge/issues) 