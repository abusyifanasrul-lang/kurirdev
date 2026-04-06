import os

def fix_order_store():
    file_path = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\stores\useOrderStore.ts'
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find and remove the stray brace
    cleaned_lines = []
    skip_next = False
    for i, line in enumerate(lines):
        # Look for the empty line with just a brace after the if(existing) block
        if "    }" in line and i > 0 and "    if (existing)" in lines[i-7]:
             # This is likely the stray brace
             if i+1 < len(lines) and lines[i+1].strip() == "" and i+2 < len(lines) and "channelStates.set" in lines[i+3]:
                 print(f"Removing stray brace at line {i+1}")
                 continue
        cleaned_lines.append(line)

    # Let's try a safer string-based approach if the above is too specific
    full_text = "".join(lines)
    # Search for the block specifically
    search_text = """    if (existing) {
      console.log(`📡 Cleaning up existing channel ${channelId} before resubscribing...`)
      supabase.removeChannel(existing)
      activeChannels.delete(channelId)
      channelStates.delete(channelId)
    }

    }"""
    
    if search_text in full_text:
        full_text = full_text.replace(search_text, """    if (existing) {
      console.log(`📡 Cleaning up existing channel ${channelId} before resubscribing...`)
      supabase.removeChannel(existing)
      activeChannels.delete(channelId)
      channelStates.delete(channelId)
    }""")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(full_text)
        print("Successfully fixed stray brace in useOrderStore.ts")
    else:
        print("Could not find search text. Investigating further...")
        # Check current state of that area
        for i in range(250, 270):
            if i < len(lines):
                print(f"{i+1}: {lines[i].strip()}")

fix_order_store()
