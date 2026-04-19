import os
import sqlite3
import subprocess
from datetime import datetime

# Paths
DB_PATH = os.path.join(os.getcwd(), ".agent", "memory.db")
MAP_PATH = os.path.join(os.getcwd(), "KNOWLEDGE_MAP.md")
HARVESTER_PATH = os.path.join(os.getcwd(), ".agent", "scripts", "antigravity_mem", "harvester.py")

def run_script(path):
    result = subprocess.run(f"python {path}", shell=True, capture_output=True, text=True)
    return result.stdout.strip()

def get_latest_observations():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT type, description, affected_files, overwritten_functions, timestamp FROM observations ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    conn.close()
    return rows

def update_knowledge_map(observations):
    print(f"Updating Knowledge Map at {MAP_PATH}...")
    
    # Read existing content
    content = ""
    if os.path.exists(MAP_PATH):
        with open(MAP_PATH, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = "# Antigravity Automated Knowledge Map\n\n> [!NOTE]\n> Peta ini diupdate otomatis oleh sistem antigravity-mem setiap kali ada commit.\n\n"

    new_section = f"\n## Session Update: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    for obs in observations:
        type_str, desc, files, overwrites, ts = obs
        new_section += f"- **Type**: {type_str}\n"
        new_section += f"- **Desc**: {desc}\n"
        if files:
            new_section += f"- **Files**: `{files}`\n"
        if overwrites:
            new_section += f"- **Overwrites**: `{overwrites}`\n"
        new_section += "---\n"

    # For now, we prepend the new updates after the header
    header_end = content.find("\n\n") + 2
    if header_end < 2: header_end = 0
    
    updated_content = content[:header_end] + new_section + content[header_end:]
    
    with open(MAP_PATH, "w", encoding="utf-8") as f:
        f.write(updated_content)
    
    print("Knowledge Map updated successfully.")

def sync():
    print("Starting Antigravity-Mem Sync...")
    
    # 1. Run Harvester
    harvest_out = run_script(HARVESTER_PATH)
    print(harvest_out)
    
    # 2. Fetch observations
    obs = get_latest_observations()
    
    # 3. Update Markdown Map
    update_knowledge_map(obs)

    # 4. Sync Knowledge Graph (Graphify)
    print("Updating Graphify Knowledge Graph...")
    graphify_out = run_script("graphify update .")
    print(graphify_out)
    
    print("Sync complete.")

if __name__ == "__main__":
    sync()
