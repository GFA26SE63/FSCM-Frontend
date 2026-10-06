# FSCM Web Portal

React and TypeScript client for the FSCM management portal. The planned portal serves Administrator, Operator, Warehouse Keeper, and Sales Manager workflows such as approvals, batch inventory, FEFO allocation review, picking oversight, retailer management, promotions, complaints, KPI reporting, and configuration.

## Current status

The project is an application skeleton. It currently renders the Vite starter screen and includes the shared environment and HTTP client setup; the planned portal workflows have not yet been implemented here.

Use the repository architecture guidance before building features:

- [Architecture assessment](../.docs/architecture/repository-skeleton.md) for boundaries and conventions

## Stack

- React 19 and TypeScript
- Vite 8
- React Router
- Axios, Apollo Client, and TanStack Query for API integration
- Zustand for client state
- Recharts for dashboards
- Tailwind CSS and Lucide icons

Packages being present does not mean their related business integrations are complete.

## Configuration

Copy the committed environment template:

```powershell
Copy-Item .env.example .env
```

Supported variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://localhost:7027` | REST/API base URL |
| `VITE_GRAPHQL_ENDPOINT` | `<API base URL>/graphql` | GraphQL endpoint |

`.env` is ignored by Git. Do not place production secrets in Vite variables because values bundled into a browser application are public.

## Development

```powershell
npm ci
npm run dev
```

The Vite development server normally starts at `http://localhost:5173`, which is included in the backend example CORS configuration.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot reload |
| `npm run lint` | Run ESLint across the project |
| `npm run build` | Type-check and create a production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |

## Source layout

```text
src/
|-- config/          Runtime environment mapping
|-- features/        Feature modules (currently a template boundary)
|-- lib/rbac/        Reserved client-side authorization conventions
|-- services/api/    Shared API client
|-- App.tsx          Current application entry screen
`-- main.tsx         React bootstrap
```

Client-side route or component guards improve the user experience but never replace authorization checks in the backend.
