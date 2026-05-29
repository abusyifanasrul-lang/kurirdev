# KurirMe — Agent Notes

> **Cursor:** behavioral rules live in `.cursor/rules/` (`alwaysApply: true`).
> **Gemini CLI:** see `GEMINI.md` (same content, Gemini-specific format).

## Project Overview

KurirMe adalah aplikasi delivery/courier management system built with:
- **Frontend:** React 19 + Vite + Tailwind CSS v4 + TypeScript
- **Mobile:** Capacitor (Android) dengan PWA fallback
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **State:** Zustand stores
- **Charts:** Recharts
- **Testing:** Vitest + happy-dom

## Librarian Protocol (Knowledge Sync)

On commit & push → `python scripts/sync_knowledge.py`

| Step | Output |
|---|---|
| Harvester | `.agent/memory.db` |
| Backup | `memory.db.bak-1` … `bak-3` |
| Knowledge map | `KNOWLEDGE_MAP.md` |
| State of union | `STATE_OF_THE_UNION.md` |
| Graphify | `graphify-out/` |

Do **not** install `graphify hook` separately — step 5 above already runs `graphify update .`.

## Graphify Knowledge Graph

Graph at `graphify-out/`. **Query the graph first** before grepping raw files.

### Graph Stats
- 161 files | 557 nodes | 595 edges | 119 communities
- Last updated: 2026-05-30
- Excludes: `android/app/src/main/assets/` via `.graphifyignore`

### Key Commands
```powershell
graphify update .
graphify query "how does auth flow work"
graphify path "useAuth" "ProtectedRoute"
graphify explain "AttendanceMonitoring()"
```

### Important Communities
| Id | Focus |
|---|---|
| Community 6 | Auth & Routing — ProtectedRoute, useAuth, AppListeners, AttendanceMonitoring |
| Community 12 | Knowledge Sync — sync_knowledge.py pipeline |
| Community 21 | Finance — calcAdminEarning, calcCourierEarning |
| Community 22 | Basecamp — BasecampIndicator, useActiveBasecamp |

### Architecture Notes
- **Zustand stores** are thin communities — verify connections via component imports in `src/`.
- **Supabase client** files connect to components via import edges, not always visible in graph.
- **Capacitor plugins** connect through native bridge; not fully captured in JS AST.

## Conventions

### Git
- Knowledge sync: `python scripts/sync_knowledge.py` on commit & push
- Commit `graphify-out/` except `manifest.json` and `cost.json`

### Code Style
- React functional components with hooks
- Zustand for global state (not Context)
- Tailwind v4 utility classes
- TypeScript strict mode

### Paths
- Source: `src/`
- Tests: `src/**/*.test.ts`
- Capacitor: `android/`, `ios/`
- Graph output: `graphify-out/`
- Agent memory: `.agent/memory.db`
