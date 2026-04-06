import os

def final_type_fix_is_online():
    auth_file = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\context\AuthContext.tsx'
    with open(auth_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Apply both is_active and is_online mapping
    if "...profile," in content:
        # We need to be careful not to double up if I already patched it
        content = content.replace("...profile,", "...profile,\n          is_active: profile.is_active ?? true,\n          is_online: profile.is_online ?? false,")
        
        with open(auth_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed AuthContext is_active and is_online type mapping")

final_type_fix_is_online()
