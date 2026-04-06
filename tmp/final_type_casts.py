import os

def final_type_casts():
    auth_file = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\context\AuthContext.tsx'
    with open(auth_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Apply the casts to the User mapping
    content = content.replace("courier_status: profile.courier_status || undefined,", "courier_status: (profile.courier_status as any) || undefined,")
    content = content.replace("vehicle_type: profile.vehicle_type || undefined,", "vehicle_type: (profile.vehicle_type as any) || undefined,")
    
    with open(auth_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed final type casts in AuthContext.tsx")

final_type_casts()
