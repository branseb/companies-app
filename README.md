# Electron React Template

A production-ready template for building cross-platform desktop applications with Electron, React, TypeScript, and SQLite. Use this as a starting point for new desktop apps.

## Technologies

| Layer | Technology |
|---|---|
| Desktop shell | [Electron](https://www.electronjs.org/) v32 |
| UI framework | [React](https://react.dev/) v18 |
| Language | [TypeScript](https://www.typescriptlang.org/) v5 (strict mode) |
| Build tool | [electron-vite](https://electron-vite.org/) |
| Database | [SQLite](https://www.sqlite.org/) via [TypeORM](https://typeorm.io/) |
| Packaging | [electron-builder](https://www.electron.build/) |

## Architecture

The app follows Electron's multi-process model with three isolated layers:

```
┌─────────────────────────────────────────────┐
│  Renderer Process (React)                   │
│  src/renderer/src/                          │
│  - React UI components                      │
│  - Accesses native features via window.api  │
└───────────────────┬─────────────────────────┘
                    │ contextBridge (IPC)
┌───────────────────▼─────────────────────────┐
│  Preload Script                             │
│  src/preload/index.ts                       │
│  - Exposes a typed window.api surface       │
│  - Bridge between renderer and main         │
└───────────────────┬─────────────────────────┘
                    │ ipcMain.handle / ipcRenderer.invoke
┌───────────────────▼─────────────────────────┐
│  Main Process (Node.js)                     │
│  src/main/                                  │
│  - BrowserWindow management                 │
│  - IPC handlers (src/main/ipc/handlers.ts)  │
│  - TypeORM / SQLite database                │
└─────────────────────────────────────────────┘
```

### Key design decisions

- **Context isolation enabled, node integration disabled** — the renderer has no direct Node.js access, eliminating a whole class of XSS-to-RCE vulnerabilities.
- **Typed IPC surface** — `window.api` is declared in `src/renderer/src/env.d.ts`, so renderer code gets full TypeScript autocomplete for every IPC call.
- **TypeORM with auto-sync** — entities are defined as decorated classes; the schema is synchronized automatically on startup, making it easy to iterate during development.
- **Database stored in user app data** — the SQLite file is placed in Electron's `app.getPath('userData')` directory, not next to the executable.
- **Separate TypeScript configs** — `tsconfig.node.json` targets the main/preload processes (decorators enabled for TypeORM) and `tsconfig.web.json` targets the renderer (DOM libs, JSX). Both are referenced by the root `tsconfig.json` composite project.

## Project Structure

```
src/
├── main/
│   ├── index.ts              # App entry — creates BrowserWindow, inits DB
│   ├── ipc/
│   │   └── handlers.ts       # ipcMain.handle registrations
│   └── database/
│       ├── data-source.ts    # TypeORM DataSource singleton
│       └── entities/
│           └── index.ts      # Entity definitions (Company, Employee)
├── preload/
│   └── index.ts              # contextBridge — exposes window.api
└── renderer/
    └── src/
        ├── main.tsx          # React entry point
        ├── App.tsx           # Root component
        ├── types.ts          # Shared TypeScript interfaces
        └── env.d.ts          # window.api type declarations
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Package into a Windows executable
npm run pack
```

The packaged app is output to `release/`.

## Adding Features

**New IPC channel:**
1. Add a handler in `src/main/ipc/handlers.ts` using `ipcMain.handle('channel-name', ...)`
2. Expose it in `src/preload/index.ts` via `contextBridge.exposeInMainWorld`
3. Declare the type in `src/renderer/src/env.d.ts`
4. Call it from the renderer with `window.api.yourMethod()`

**New database entity:**
1. Define a TypeORM entity class in `src/main/database/entities/`
2. Add it to the `entities` array in `src/main/database/data-source.ts`
3. TypeORM will sync the schema on next launch
