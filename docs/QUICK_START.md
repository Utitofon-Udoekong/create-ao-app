# Forge Quick Start Guide

Get up and running with Forge in 5 minutes! 🚀

## Prerequisites

- Node.js 18+ installed
- npm, yarn, or pnpm package manager
- OpenAI or Anthropic API key (for AI features)

## Installation

```bash
# Install globally
npm install -g forge-ao

# Or use npx (no installation required)
npx forge-ao init my-app
```

## Quick Start

### 1. Create Your First Project

```bash
# Create a new AO project
forge init my-first-ao-app

# Navigate to the project
cd my-first-ao-app
```

### 2. Generate Your First Contract

```bash
# Generate a simple counter contract
forge ai --template counter --output ao/counter.lua

# Or use AI to generate from description
forge ai --prompt "Create a simple token contract with transfer function" --output ao/token.lua
```

### 3. Start Development

```bash
# Start development server
forge dev

# Or start with AO process monitoring
forge dev:ao
```

### 4. Deploy Your Contract

```bash
# Deploy to AO network
forge ao:start -n "my-counter" --tag-name "type" --tag-value "counter"
```

## Interactive AI Session

Experience the power of AI-assisted development:

```bash
# Start interactive session
forge ai --interactive

# Try these commands in the session:
> generate Create a simple voting contract
> analyze voting.lua
> optimize voting.lua security
> document voting.lua markdown
> exit
```

## Common Workflows

### Building a DAO

```bash
# 1. Generate DAO contract
forge ai --template dao --output ao/dao.lua

# 2. Generate tests
forge ai --file ao/dao.lua --test --output ao/tests/dao.test.lua

# 3. Analyze and optimize
forge ai --file ao/dao.lua --analyze
forge ai --file ao/dao.lua --optimize security

# 4. Generate documentation
forge ai --file ao/dao.lua --document markdown --output docs/dao.md

# 5. Deploy
forge ao:start -n "my-dao" --tag-name "type" --tag-value "dao"
```

### Building a Marketplace

```bash
# 1. Generate marketplace contract
forge ai --template marketplace --output ao/marketplace.lua

# 2. Generate integration tests
forge ai --file ao/marketplace.lua --integration-tests api --output ao/tests/marketplace.integration.lua

# 3. Security audit
forge ai --file ao/marketplace.lua --audit

# 4. Deploy with monitoring
forge ao:start -n "my-marketplace" --monitor
```

## Configuration

### Set Up AI API Keys

```bash
# Option 1: Environment variables
export OPENAI_API_KEY='your-openai-key'
export ANTHROPIC_API_KEY='your-anthropic-key'

# Option 2: CLI configuration
forge config set ai.openai_key 'your-key'
forge config set ai.anthropic_key 'your-key'
```

### Project Configuration

Edit `ao.config.yml` in your project:

```yaml
# Basic configuration
framework: 'nextjs'
packageManager: 'pnpm'
processName: 'my-process'

# AO settings
aos:
  version: '2.x'
  features:
    coroutines: true
    bootloader: false
    weavedrive: false

# AI settings
ai:
  default_provider: 'openai'
  default_model: 'gpt-4o-mini'
  temperature: 0.7
```

## Available Templates

Quick start with these pre-built templates:

- **counter** - Simple counter with increment/decrement
- **token** - Basic token with transfer functionality  
- **nft** - Non-fungible token implementation
- **dao** - Decentralized autonomous organization
- **marketplace** - Decentralized marketplace
- **oracle** - Price oracle for external data
- **multisig** - Multi-signature wallet
- **lending** - Decentralized lending protocol

## AI Features

### Code Generation
```bash
# From prompt
forge ai --prompt "Create a simple game contract"

# From template
forge ai --template nft

# Interactive
forge ai --interactive
```

### Code Analysis
```bash
# Analyze code quality
forge ai --file contract.lua --analyze

# Security audit
forge ai --file contract.lua --audit

# Performance optimization
forge ai --file contract.lua --optimize performance
```

### Documentation
```bash
# Generate markdown docs
forge ai --file contract.lua --document markdown

# Generate HTML docs
forge ai --file contract.lua --document html
```

### Testing
```bash
# Generate unit tests
forge ai --file contract.lua --test

# Generate integration tests
forge ai --file contract.lua --integration-tests api
```

## Next Steps

1. **Explore Templates** - Try different contract templates
2. **Interactive AI** - Use `forge ai --interactive` for guided development
3. **Advanced Features** - Experiment with optimization, auditing, and batch processing
4. **Deploy** - Deploy your contracts to the AO network
5. **Monitor** - Use monitoring features to track your processes

## Getting Help

- **Documentation**: Check the full [CLI Reference](CLI_REFERENCE.md)
- **Examples**: See the `examples/` directory for sample projects
- **Community**: Join our Discord for support and discussions
- **Issues**: Report bugs on GitHub

Happy coding! 🎉 