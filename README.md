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

## Installation

```bash
# Using npm
npm install -g create-ao-app

# Using pnpm
pnpm add -g create-ao-app

# Or use directly with npx
npx create-ao-app my-app
```

## Usage

```bash
# Basic usage
create-ao-app my-app

# Specify framework
create-ao-app my-app --framework nextjs

# Use in existing directory
create-ao-app --path ./existing-directory

# Specify package manager
create-ao-app --package-manager yarn

# Using npx
npx create-ao-app my-app --framework nextjs --package-manager yarn

# Interactive mode (default)
create-ao-app
```

### Command Line Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--framework <name>` | `-f` | Specify framework (nextjs or nuxtjs) |
| `--path <path>` | `-p` | Create project in specific directory |
| `--help` | `-h` | Display help information |
| `--version` | `-V` | Display version number |

## Project Structure

The CLI will create a project with the following structure:

```
my-app/
├── README.md
├── node_modules/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── [framework-specific-files]
```

## Development

Want to contribute or test locally? Here's how:

```bash
# Clone the repository
git clone https://github.com/Utitofon-Udoekong/create-ao-app.git
cd create-ao-app

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link for local testing
pnpm link --global

# Test the CLI
create-ao-app test-app

# Unlink when done testing
pnpm unlink --global
```

### Development Scripts

```bash
# Watch mode during development
pnpm dev

# Build the project
pnpm build

# Test locally without linking
pnpm try my-test-app

# Clean build files
pnpm clean

# Rebuild the project
pnpm rebuild

# Link for global usage
pnpm link-local

# Unlink global installation
pnpm unlink-local
```

### Local Template Testing

To test with local templates:

1. Set up environment variables:
```bash
export NEXT_TEMPLATE="./path/to/local/nextjs-template"
export NUXT_TEMPLATE="./path/to/local/nuxtjs-template"
export DEBUG="true"
```

2. Run with local flag:
```bash
pnpm try my-app --local
```

### Debugging

Set the `DEBUG` environment variable to enable debug logs:

```bash
DEBUG=true create-ao-app my-app
```

## Troubleshooting

### Common Issues

1. **Permission Errors**
```bash
# Fix npm global permissions
sudo chown -R $USER /usr/local/lib/node_modules
```

2. **Directory Not Empty**
```bash
# Use force flag or ensure directory is empty
rm -rf my-app
create-ao-app my-app
```

3. **Git Not Initialized**
```bash
# Initialize git manually
cd my-app
git init
git add .
git commit -m "Initial commit"
```

### Error Messages

- `Error: Directory not empty`: The target directory contains files
- `Error: Git clone failed`: Unable to clone template repository
- `Error: Installation failed`: Package installation failed

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js)
- Interactive prompts by [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- Progress spinners with [Ora](https://github.com/sindresorhus/ora)
- File system operations with [fs-extra](https://github.com/jprichardson/node-fs-extra)

## Support

For support, please [open an issue](https://github.com/Utitofon-Udoekong/create-ao-app/issues) on GitHub.