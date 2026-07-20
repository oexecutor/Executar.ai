# Executar.ai - DESK-OS MCP

[![CI](https://github.com/oexecutor/Executar.ai/actions/workflows/ci.yml/badge.svg)](https://github.com/oexecutor/Executar.ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Professional implementation of the DESK-OS Model Context Protocol (MCP) for advanced project management automation.

## 🚀 Features

- **Vault Management**: Full control over your Obsidian-style vault via MCP.
- **Workflow Automation**: Pre-defined DESK-OS workflows for material-to-project, evidence-to-decision, and more.
- **Secure Persistence**: Integrated with Netlify Blobs for reliable data storage.
- **OAuth2 Ready**: Secure client registration and authorization flow.

## 🛠️ Setup & Development

### Prerequisites

- Node.js >= 20
- npm
- Netlify CLI (`npm install -g netlify-cli`)

### Installation

```bash
npm install
```

### Local Development

```bash
npm run dev
```

### Running Tests

```bash
npm test
npm run test:smoke
```

## 📂 Project Structure

- `src/`: Core logic and MCP server implementation.
- `netlify/functions/`: Serverless functions for API endpoints.
- `public/`: Frontend assets and dashboard.
- `docs/`: Comprehensive project documentation.
- `contracts/`: Interface and protocol definitions.

## 🔒 Security

For security reports or information about our open-access model, please refer to [SECURITY.md](./SECURITY.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
