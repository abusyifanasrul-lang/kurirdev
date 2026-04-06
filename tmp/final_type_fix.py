import os

def final_type_fix():
    # 1. AuthContext.tsx fix (phone null -> undefined)
    auth_file = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\context\AuthContext.tsx'
    with open(auth_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We need to fix the User mapping
    bad_mapping = """        const userData: User = {
          ...profile,
          email,
          role: profile.role as UserRole,
          created_at: profile.created_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
        };"""
        
    good_mapping = """        const userData: User = {
          ...profile,
          email,
          phone: profile.phone || undefined, // Fix null to undefined
          role: profile.role as UserRole,
          created_at: profile.created_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
        };"""
    
    if bad_mapping in content:
        content = content.replace(bad_mapping, good_mapping)
        with open(auth_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed AuthContext type mapping")

    # 2. useOrderStore.ts fix (unused variable)
    store_file = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\stores\useOrderStore.ts'
    with open(store_file, 'r', encoding='utf-8') as f:
        content = f.read()

    bad_var = "    const currentState = channelStates.get(channelId)"
    if bad_var in content:
        content = content.replace(bad_var, "")
        with open(store_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Removed unused variable in useOrderStore.ts")

final_type_fix()
