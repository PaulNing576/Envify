# Envify — Secret Scanner for VS Code

Prevent accidental API key leaks before they reach GitHub. Envify scans your code in real-time, detects hardcoded secrets (OpenAI, Anthropic, Gemini, DeepSeek keys and more), and offers one-click fixes to replace them with environment variables.

## Features

- **Real-time scanning** — Detects secrets as you type in Python, JavaScript, TypeScript, JSX, and TSX files
- **Smart detection** — Uses AST parsing (tree-sitter) for precise detection with low false positives
- **Provider coverage** — Built-in patterns for OpenAI, Anthropic, Gemini, and DeepSeek
- **Entropy analysis** — Detects unknown high-entropy strings assigned to suspicious variable names
- **One-click Quick Fix** — Replace hardcoded keys with `os.getenv()` or `process.env` with Ctrl+.
- **Automatic .env generation** — Creates or updates your `.env` file with the detected value
- **.gitignore management** — Ensures `.env` is listed in `.gitignore`
- **Custom patterns** — Add your own regex patterns for additional secret types

## Quick Start

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/)
2. Open a Python or JavaScript file
3. Type `api_key = "sk-proj-..."` — a warning squiggly appears
4. Press `Ctrl+.` (or `Cmd+.` on Mac) and select **"Replace with environment variable"**
5. The key is replaced with `os.getenv("OPENAI_API_KEY")`, `.env` is updated, and `.gitignore` is checked

## Configuration

```json
{
  "envify.enabled": true,
  "envify.providers": ["openai", "anthropic", "gemini", "deepseek"],
  "envify.entropyThreshold": 4.5,
  "envify.customPatterns": [],
  "envify.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**"
  ],
  "envify.largeFileThreshold": 5000,
  "envify.autoFixOnSave": false
}
```

### Custom Patterns

Add your own secret patterns in VS Code settings:

```json
{
  "envify.customPatterns": [
    {
      "name": "MyService",
      "regex": "^ms-[A-Za-z0-9]{32}$",
      "envVarName": "MYSERVICE_API_KEY"
    }
  ]
}
```

## Supported Providers

| Provider | Key Pattern | Env Var |
|---|---|---|
| OpenAI | `sk-proj-...`, `sk-svcacct-...`, `sk-admin-...`, `sk-...` | `OPENAI_API_KEY` |
| Anthropic | `sk-ant-api03-...` | `ANTHROPIC_API_KEY` |
| Google Gemini | `AIzaSy...` | `GEMINI_API_KEY` |
| DeepSeek | `sk-[a-f0-9]{32}` | `DEEPSEEK_API_KEY` |

## Supported Languages

- Python
- JavaScript
- TypeScript
- JSX / TSX (React)

## Commands

- **Envify: Scan Workspace for Secrets** — Manually scan all open files
- **Envify: Generate .env File** — Create a `.env` file in the workspace root
- **Envify: Ignore This Secret** — Add a suppression comment on the current line

## Suppressing False Positives

Add a comment on the line before the detected secret:

```python
# envify:ignore-next-line
example_key = "sk-this-is-just-an-example"
```

## Development

```bash
# Install dependencies
npm install

# Build tree-sitter WASM grammars (requires tree-sitter CLI)
npm run build:wasm

# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Run unit tests
npm test

# Package for distribution
npm run package
```

## Architecture

- **AST Parsing**: [web-tree-sitter](https://github.com/tree-sitter/tree-sitter) for precise code structure analysis
- **Pattern Matching**: Regex patterns for known providers + Shannon entropy for unknown keys
- **Quick Fix**: VS Code CodeActionProvider with atomic WorkspaceEdits

## License

MIT
