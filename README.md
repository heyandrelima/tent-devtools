# Vite + React + TypeScript + Electron + Tailwind CSS Starter

This template provides a minimal setup to kickstart a desktop application using **Vite**, **React**, **TypeScript**, **Electron**, and **Tailwind CSS**. It includes hot module replacement (HMR), ESLint configuration, and a streamlined development workflow.

## Features

- **Vite**: Fast build tool with HMR for a smooth development experience.
- **React**: A powerful library for building user interfaces.
- **TypeScript**: Static typing for better code quality and maintainability.
- **Electron**: Build cross-platform desktop applications.
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development.
- **ESLint**: Pre-configured linting for consistent and error-free code.

## Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [pnpm](https://pnpm.io/) (preferred package manager)

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/your-repo/vite-react-tailwind-electron.git
   cd vite-react-tailwind-electron
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

### Development

To start the development server and Electron app:

```bash
pnpm run dev
```

This will:

- Start the Vite development server on `http://localhost:5173`.
- Launch the Electron app and load the Vite server.

### Build

To build the production-ready Electron app:

```bash
pnpm run build
```

This will bundle the Vite app and package the Electron app using `electron-builder`.

### Linting

To lint your code:

```bash
pnpm run lint
```

## Project Structure

```
├── public/               # Static assets
├── src/                  # Source code
│   ├── assets/           # Images and other assets
│   ├── App.tsx           # Main React component
│   ├── main.tsx          # React entry point
│   ├── vite-env.d.ts     # Vite environment types
├── main.js               # Electron main process
├── index.html            # HTML template
├── package.json          # Project metadata and scripts
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── tsconfig.app.json     # Additional TypeScript configuration
```

## Dependencies

### Core Dependencies

- `react`: UI library
- `react-dom`: React DOM rendering
- `electron`: Desktop app framework
- `tailwindcss`: CSS framework

### Development Dependencies

- `vite`: Build tool
- `@vitejs/plugin-react`: React plugin for Vite
- `typescript`: TypeScript support
- `eslint`: Linting tool
- `typescript-eslint`: TypeScript linting rules
- `eslint-plugin-react-hooks`: React hooks linting
- `eslint-plugin-react-refresh`: React Fast Refresh linting
- `concurrently`: Run multiple commands concurrently
- `wait-on`: Wait for resources to be available

## License

This project is licensed under the MIT License. Feel free to use it as a starting point for your own projects.
