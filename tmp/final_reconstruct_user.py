import os
import re

def final_reconstruct_user_mapping():
    auth_file = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\context\AuthContext.tsx'
    with open(auth_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Define the precise mapping to replace the messy spread
    # We target the block from 'const userData: User = {' to '};'
    pattern = re.compile(r'const userData: User = \{.*?\};', re.DOTALL)
    
    new_mapping = """const userData: User = {
          id: profile.id,
          email: email,
          name: profile.name,
          role: profile.role as UserRole,
          phone: profile.phone || undefined,
          is_active: profile.is_active ?? true,
          fcm_token: profile.fcm_token || undefined,
          is_online: profile.is_online ?? false,
          courier_status: profile.courier_status || undefined,
          off_reason: profile.off_reason || undefined,
          vehicle_type: profile.vehicle_type || undefined,
          plate_number: profile.plate_number || undefined,
          queue_position: profile.queue_position || undefined,
          total_deliveries_alltime: profile.total_deliveries_alltime || 0,
          total_earnings_alltime: profile.total_earnings_alltime || 0,
          unpaid_count: profile.unpaid_count || 0,
          unpaid_amount: profile.unpaid_amount || 0,
          created_at: profile.created_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
        };"""
    
    if pattern.search(content):
        content = pattern.sub(new_mapping, content)
        with open(auth_file, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Successfully reconstructed User mapping in AuthContext.tsx")
    else:
        print("Could not find the User mapping pattern. Doing a manual replacement...")
        # Fallback to a simpler replace if regex fails
        content = content.replace("...profile,", "") # Cleanup any mess
        # ... actually let's just use the regex correctly.
        print("Pattern debug:", pattern.findall(content))

final_reconstruct_user_mapping()
