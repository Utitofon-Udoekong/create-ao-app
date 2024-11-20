# Create AO App

A powerful CLI tool for creating and managing AO-powered applications with seamless integration for Next.js and Nuxt.js projects.

## Features

- 🚀 Quick project scaffolding with Next.js or Nuxt.js
- 🔄 Advanced AO process management
- ⚡ Automatic process monitoring and evaluation
- 📦 Multiple package manager support (npm, yarn, pnpm)
- 🎯 Process pattern matching
- ⏰ Flexible scheduler configuration
- 🛠 Comprehensive configuration options

## Installation

```bash
npm install -g create-ao-app
# or
yarn global add create-ao-app
# or
pnpm add -g create-ao-app
```

## Quick Start

```bash
# Create a new project
create-ao-app my-awesome-project

# Create with specific options
create-ao-app my-project --framework nextjs --package-manager pnpm
```

## Configuration

### ao.config.yml

```yaml
luaFiles:
  'src/contracts/token.lua':
    processName: token-process
    scheduler:
      interval: 1000
      tick: "tick"
      patterns:
        - "token:*"
        - "transfer:*"
    evaluator: "Initialize()"
    messageHandler: "handle"
  'src/contracts/main.lua':
    processName: main-process
packageManager: pnpm
autoStart: true
ports:
  dev: 3000
```

### aos.config.js (Auto-generated)

```javascript
module.exports = {
  module: "src/contracts/token.lua",
  process: "token-process",
  scheduler: {
    interval: 1000,
    tick: "tick"
  }
};
```

## CLI Commands

### Project Creation
```bash
# Basic usage
create-ao-app [project-name]

# With options
create-ao-app [project-name] [options]

Options:
  -f, --framework <framework>    Framework to use (nextjs or nuxtjs)
  -p, --path <path>             Path to create the project in
  --no-aos-process              Skip automatic AO process creation
  --package-manager <pm>        Package manager to use (npm, yarn, pnpm)
  --config <path>               Path to configuration file
  -m, --monitor                 Monitor AO processes after starting
  -e, --eval <input>           Evaluate process after starting
```

### Process Management
```bash
# List all processes
create-ao-app processes

# Monitor specific process
create-ao-app monitor <process-name>

# Evaluate process
create-ao-app eval <process-name> "message"

# Watch process patterns
create-ao-app watch <process-name> "pattern:*"

# Start scheduler
create-ao-app schedule <process-name>

# Stop scheduler
create-ao-app schedule-stop <process-name>
```

## Advanced Features

### Process Pattern Matching

Monitor specific message patterns:
```bash
create-ao-app watch token-process "token:transfer:*"
```

### Scheduler Configuration

```yaml
scheduler:
  interval: 1000  # Milliseconds
  tick: "tick"    # Function to call
  patterns:       # Patterns to match
    - "tick:*"
    - "cron:*"
  maxRetries: 3   # Maximum retry attempts
  onError: "handleError"  # Error handler function
```

### Message Handlers

```lua
-- Example message handler in Lua
function handle(msg)
  if msg:match("token:transfer:*") then
    -- Handle transfer
  elseif msg:match("token:mint:*") then
    -- Handle minting
  end
end
```

## Development

### Requirements

- Node.js >= 18
- AOS CLI installed globally
- Git

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/create-ao-app.git
cd create-ao-app

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test process-manager

# Run tests in watch mode
pnpm test --watch
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details