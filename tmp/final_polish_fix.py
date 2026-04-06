import os

def final_polish_fix():
    # 1. AuthContext.tsx - map is_active: boolean | null to boolean
    auth_file = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\context\AuthContext.tsx'
    with open(auth_file, 'r', encoding='utf-8') as f:
        content = f.read()

    bad_is_active = "...profile,"
    # Looking for the User mapping area
    if "...profile," in content:
        content = content.replace("...profile,", "...profile,\n          is_active: profile.is_active ?? true,")
        
        with open(auth_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed AuthContext is_active type mapping")

    # 2. useOrderStore.ts - fix missing currentState in resyncRealtime
    store_file = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\stores\useOrderStore.ts'
    with open(store_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find line 174 or where currentState is used and missing
    new_lines = []
    for line in lines:
        if "if (!currentState || currentState === 'errored' || currentState === 'closed') {" in line:
            # We need to add const currentState = channelStates.get(channelId) above it
            new_lines.append("    const currentState = channelStates.get(channelId)\n")
        new_lines.append(line)

    with open(store_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Fixed useOrderStore resyncRealtime state access")

final_polish_fix()
