"""
Knowledge Sync Script
======================
Orchestrates the full knowledge pipeline:
1. Run Harvester (git diff → memory.db)
2. Backup memory.db (rotating 3 copies)
3. Fetch observations (filtered by confidence)
4. Update KNOWLEDGE_MAP.md
5. Update STATE_OF_THE_UNION.md (high-confidence only)
6. Update Graphify knowledge graph
"""

import os
import shutil
import sqlite3
import subprocess
from datetime import datetime

# Paths
DB_PATH = os.path.join(os.getcwd(), ".agent", "memory.db")
MAP_PATH = os.path.join(os.getcwd(), "KNOWLEDGE_MAP.md")
SOTU_PATH = os.path.join(os.getcwd(), "STATE_OF_THE_UNION.md")
HARVESTER_PATH = os.path.join(
    os.getcwd(), ".agent", "scripts", "antigravity_mem", "harvester.py"
)
MIGRATE_PATH = os.path.join(
    os.getcwd(), ".agent", "scripts", "antigravity_mem", "migrate_memory_db.py"
)

# Confidence threshold: observations below this are excluded from SOTU
SOTU_CONFIDENCE_THRESHOLD = 0.5
MAX_BACKUPS = 3


def run_script(path):
    result = subprocess.run(f"python {path}", shell=True, capture_output=True, text=True)
    return result.stdout.strip()


def backup_database():
    """Rotate backups: memory.db.bak-1 (newest) → .bak-3 (oldest). Delete beyond MAX_BACKUPS."""
    if not os.path.exists(DB_PATH):
        return

    # Rotate existing backups downward
    for i in range(MAX_BACKUPS, 1, -1):
        older = f"{DB_PATH}.bak-{i}"
        newer = f"{DB_PATH}.bak-{i - 1}"
        if os.path.exists(newer):
            shutil.copy2(newer, older)

    # Create newest backup
    shutil.copy2(DB_PATH, f"{DB_PATH}.bak-1")

    # Remove excess backups
    for i in range(MAX_BACKUPS + 1, MAX_BACKUPS + 5):
        excess = f"{DB_PATH}.bak-{i}"
        if os.path.exists(excess):
            os.remove(excess)

    print(f"Database backed up (rotating {MAX_BACKUPS} copies).")


def get_latest_observations(min_confidence=None):
    """Fetch latest observations, optionally filtered by confidence."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if min_confidence is not None:
        cursor.execute(
            """SELECT type, description, affected_files, overwritten_functions,
                      timestamp, confidence, detection_method, change_type
               FROM observations
               WHERE confidence >= ?
               ORDER BY id DESC LIMIT 10""",
            (min_confidence,),
        )
    else:
        cursor.execute(
            """SELECT type, description, affected_files, overwritten_functions,
                      timestamp, confidence, detection_method, change_type
               FROM observations
               ORDER BY id DESC LIMIT 10"""
        )

    rows = cursor.fetchall()
    conn.close()
    return rows


def update_state_of_the_union(observations):
    if not os.path.exists(SOTU_PATH):
        return

    print(f"Updating State of the Union at {SOTU_PATH}...")

    with open(SOTU_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    walkthroughs = []
    for obs in observations:
        type_str, desc = obs[0], obs[1]
        if "WALKTHROUGH" in desc or type_str == "legacy_backfill":
            lines = desc.split("\n")
            for line in lines:
                if line.startswith("# Walkthrough"):
                    title = (
                        line.replace("# Walkthrough - ", "")
                        .replace("# Walkthrough: ", "")
                        .strip()
                    )
                    if title not in walkthroughs:
                        walkthroughs.append(title)

    if not walkthroughs:
        return

    section_title = "## 🚀 Recent Major Updates"
    section_start = content.find(section_title)
    if section_start == -1:
        return

    section_end = content.find("\n---", section_start + len(section_title))
    if section_end == -1:
        section_end = len(content)

    new_updates_list = []
    for wt in walkthroughs[:3]:
        new_updates_list.append(f"- **{wt}**: Recently implemented/hardened.")

    new_updates_text = "\n".join(new_updates_list) + "\n"

    updated_section = f"{section_title}\n{new_updates_text}"
    updated_content = content[:section_start] + updated_section + content[section_end:]

    with open(SOTU_PATH, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print("State of the Union updated successfully.")


def update_knowledge_map(observations):
    print(f"Updating Knowledge Map at {MAP_PATH}...")

    content = ""
    if os.path.exists(MAP_PATH):
        with open(MAP_PATH, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = (
            "# Antigravity Automated Knowledge Map\n\n"
            "> [!NOTE]\n"
            "> Peta ini diupdate otomatis oleh sistem antigravity-mem setiap kali ada commit.\n\n"
        )

    new_section = f"\n## Session Update: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    for obs in observations:
        type_str, desc, files, overwrites, ts = obs[0], obs[1], obs[2], obs[3], obs[4]
        confidence = obs[5] if len(obs) > 5 else None
        detection_method = obs[6] if len(obs) > 6 else None
        change_type = obs[7] if len(obs) > 7 else None

        new_section += f"- **Type**: {type_str}\n"
        new_section += f"- **Desc**: {desc}\n"
        if files:
            new_section += f"- **Files**: `{files}`\n"
        if overwrites:
            new_section += f"- **Overwrites**: `{overwrites}`\n"
        if confidence is not None:
            new_section += f"- **Confidence**: {confidence}\n"
        if detection_method:
            new_section += f"- **Method**: {detection_method}\n"
        if change_type and change_type != "unknown":
            new_section += f"- **Change Type**: {change_type}\n"
        new_section += "---\n"

    header_end = content.find("\n\n") + 2
    if header_end < 2:
        header_end = 0

    updated_content = content[:header_end] + new_section + content[header_end:]

    with open(MAP_PATH, "w", encoding="utf-8") as f:
        f.write(updated_content)

    print("Knowledge Map updated successfully.")


def sync():
    print("Starting Antigravity-Mem Sync...")

    # 0. Ensure schema is up to date
    if os.path.exists(MIGRATE_PATH):
        print("Running schema migration...")
        migrate_out = run_script(MIGRATE_PATH)
        print(migrate_out)

    # 1. Run Harvester
    harvest_out = run_script(HARVESTER_PATH)
    print(harvest_out)

    # 2. Backup database BEFORE any reads/writes
    backup_database()

    # 3. Fetch ALL observations for Knowledge Map (no filter)
    all_obs = get_latest_observations(min_confidence=None)

    # 4. Update Markdown Map (includes ALL observations, even low-confidence)
    update_knowledge_map(all_obs)

    # 5. Fetch HIGH-CONFIDENCE observations for SOTU
    high_confidence_obs = get_latest_observations(
        min_confidence=SOTU_CONFIDENCE_THRESHOLD
    )

    # 6. Update State of the Union (filtered)
    update_state_of_the_union(high_confidence_obs)

    # 7. Sync Knowledge Graph (Graphify)
    print("Updating Graphify Knowledge Graph...")
    graphify_out = run_script("graphify update .")
    print(graphify_out)

    # 8. Check for unreviewed unclassified logs
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='unclassified_log'")
    if cursor.fetchone() is not None:
        try:
            unclassified_count = cursor.execute(
                "SELECT COUNT(*) FROM unclassified_log WHERE reviewed = 0"
            ).fetchone()[0]
            if unclassified_count > 10:
                print(f"\n[WARNING] {unclassified_count} unclassified entries detected.")
                print("          Run: python .agent/scripts/antigravity_mem/review_unclassified.py")
        except sqlite3.OperationalError:
            pass # Handle case where reviewed column might not exist yet if migration failed
    conn.close()

    print("Sync complete.")


if __name__ == "__main__":
    sync()
