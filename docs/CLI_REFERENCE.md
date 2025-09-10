# Forge CLI Reference

## Overview

Forge is a comprehensive CLI tool for building, managing, and deploying AO smart contracts with AI-powered code generation capabilities.

## Commands

### `ao-forge ai` - AI-Powered Code Generation

The AI command provides comprehensive code generation, analysis, and optimization for AO smart contracts.

#### Basic Usage

```bash
# Generate code from prompt
ao-ao-forge ai --prompt "Create a counter contract"

# Generate from template
ao-ao-forge ai --template counter --output counter.lua

# Start interactive session
ao-ao-forge ai --interactive
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
ao-forge ai --file contract.lua --optimize performance

# Optimize for security
ao-forge ai --file contract.lua --optimize security

# Optimize for readability
ao-forge ai --file contract.lua --optimize readability
```

**Documentation Generation:**
```bash
# Generate markdown documentation
ao-forge ai --file contract.lua --document markdown

# Generate HTML documentation
ao-forge ai --file contract.lua --document html

# Generate JSON documentation
ao-forge ai --file contract.lua --document json
```

**Security Auditing:**
```bash
# Perform comprehensive security audit
ao-forge ai --file contract.lua --audit
```

**Batch Processing:**
```bash
# Analyze multiple files
ao-forge ai --file "file1.lua,file2.lua,file3.lua" --batch analyze

# Optimize multiple files
ao-forge ai --file "*.lua" --batch optimize

# Generate documentation for multiple files
ao-forge ai --file "contracts/*.lua" --batch document
```

**Migration Scripts:**
```bash
# Generate migration to AOS 2.0
ao-forge ai --file contract.lua --migrate aos-2.0

# Generate migration to new framework
ao-forge ai --file contract.lua --migrate new-framework
```

**Integration Tests:**
```bash
# Generate API integration tests
ao-forge ai --file contract.lua --integration-tests api

# Generate database integration tests
ao-forge ai --file contract.lua --integration-tests database

# Generate external integration tests
ao-forge ai --file contract.lua --integration-tests external
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
ao-forge ai --interactive
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

### `ao-forge init` - Project Initialization

Initialize a new AO project with framework support.

```bash
# Interactive mode (recommended)
ao-forge init my-app

# Specify framework
ao-forge init my-app --framework nextjs

# Use in existing directory
ao-forge init --path ./existing-directory

# Specify package manager
ao-forge init my-app --package-manager pnpm
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `-f, --framework` | Framework to use | `--framework nextjs` |
| `-p, --path` | Path to create project | `--path ./my-app` |
| `--package-manager` | Package manager | `--package-manager pnpm` |

### `ao-forge dev` - Development Server

Start the development server.

```bash
# Start development server
ao-forge dev
```

### `ao-forge build` - Build Project

Build the project for production.

```bash
# Build project
ao-forge build

# Build with specific output directory
ao-forge build -o ./dist

# Clean and build
ao-forge build --clean
```

The build process will:
- Compile and optimize the framework code
- Generate deployment artifacts
- Create a deployment manifest

Note: AO process building is handled by the AOS CLI directly.

### `ao-forge process` - AO Process Management

Manage AO processes with built-in commands.

```bash
# Start an AO process
ao-forge process start

# Start with custom name
ao-forge process start -n "my-process"

# Stop a running process
ao-forge process stop

# List processes
ao-forge process list
```

### `ao-forge config` - Configuration Management

Manage project configuration settings.

```bash
# Get a configuration value
ao-forge config get processName

# Set a configuration value
ao-forge config set processName "my-process"

# Set nested configuration
ao-forge config set ports.dev 8080

# List all configuration
ao-forge config list

# List in JSON format
ao-forge config list --format json

# Initialize default configuration
ao-forge config init

# Validate configuration file
ao-forge config validate

# Create configuration backup
ao-forge config backup

# Restore from backup
ao-forge config restore ./ao.config.yml.backup.1234567890
```

## AO Process Management (Alternative)

You can also use the AOS CLI directly:

```bash
# Install AOS CLI
npm i -g https://get_ao.g8way.io

# Start an AO process
aos [process-name]

# Load Lua files
aos [process-name] --load ./ao/contract.lua

# Monitor process
aos [process-name] --monitor

# For more AOS commands, visit: https://docs.arweave.org/developers/ao
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
ao-forge init my-dao --framework nextjs --package-manager pnpm

# 2. Navigate to project
cd my-dao

# 3. Generate DAO contract using AI
ao-forge ai --template dao --output ao/dao.lua

# 4. Generate tests for the contract
ao-forge ai --file ao/dao.lua --test --output ao/tests/dao.test.lua

# 5. Analyze the contract
ao-forge ai --file ao/dao.lua --analyze

# 6. Optimize for security
ao-forge ai --file ao/dao.lua --optimize security

# 7. Generate documentation
ao-forge ai --file ao/dao.lua --document markdown --output docs/dao.md

# 8. Start development server
ao-forge dev

# 9. Deploy AO process
ao-forge ao:start -n "my-dao" --tag-name "type" --tag-value "dao" --monitor
```

### Interactive AI Session Example

```bash
# Start interactive session
ao-forge ai --interactive

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
   ao-forge config set ai.openai_key 'your-key'
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
ao-forge ai --prompt "test" --debug
```

## Support

For more information and support:

- **Documentation**: [https://docs.ao-forge-ao.com](https://docs.ao-forge-ao.com)
- **GitHub**: [https://github.com/ao-forge-ao/ao-forge](https://github.com/ao-forge-ao/ao-forge)
- **Discord**: [https://discord.gg/ao-forge-ao](https://discord.gg/ao-forge-ao)
- **Issues**: [https://github.com/ao-forge-ao/ao-forge/issues](https://github.com/ao-forge-ao/ao-forge/issues) 