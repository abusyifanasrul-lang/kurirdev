> **Cursor IDE:** use `AGENTS.md` + `.cursor/rules/` — this file is for Gemini CLI only.

### 🧠 Automated Memory

On "commit and push" → run: `python scripts/sync_knowledge.py`

Pipeline (`scripts/sync_knowledge.py`):
1. Harvester — git diff → `.agent/memory.db`
2. Backup `memory.db` (rotating 3 copies)
3. Update `KNOWLEDGE_MAP.md`
4. Update `STATE_OF_THE_UNION.md` (high-confidence only)
5. **Graphify** — `graphify update .` → `graphify-out/`

Do **not** install a separate `graphify hook` — graph rebuild is already orchestrated here.

---

## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
- Android build assets are excluded via `.graphifyignore` — query source files in `src/`, not `android/app/src/main/assets/`

Key commands:
```powershell
graphify update .
graphify query "how does auth flow work"
graphify explain "AttendanceMonitoring()"
```
