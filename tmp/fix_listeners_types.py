import os

file_path = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\components\AppListeners.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix type for fcmCleanup
old_line = 'let fcmCleanup: { unsubscribe?: () => void } = {}'
new_line = 'let fcmCleanup: { unsubscribe?: any } = {}'
content = content.replace(old_line, new_line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully fixed types in AppListeners.tsx")
