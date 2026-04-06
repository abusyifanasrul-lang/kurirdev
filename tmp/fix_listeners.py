import os

file_path = r'c:\Users\K4G3\Documents\GitHub\kurirdev\src\components\AppListeners.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix double declaration on line 64
bad_line = 'const unsubOrders = orderStore.subscribeOrders(filter)const unsubOrders = orderStore.subscribeOrders(filter)'
good_line = 'const unsubOrders = orderStore.subscribeOrders(filter)'
content = content.replace(bad_line, good_line)

# Fix cleanup function
bad_cleanup = """    return () => {
      if (typeof unsubOrders === 'function') unsubOrders()
      if (typeof unsubNotifs === 'function') unsubNotifs()
      if (fcmCleanup.unsubscribe) fcmCleanup.unsubscribe()
      if (fcmRefreshInterval) clearInterval(fcmRefreshInterval)
    }"""

good_cleanup = """    return () => {
      if (typeof unsubOrders === 'function') unsubOrders()
      if (typeof unsubNotifs === 'function') unsubNotifs()
      if (fcmRefreshInterval) clearInterval(fcmRefreshInterval)
      if (fcmCleanup.unsubscribe) {
        const u = fcmCleanup.unsubscribe
        if (typeof u === 'function') {
          u()
        } else if (u && typeof (u as any).then === 'function') {
          (u as any).then((h: any) => h.remove?.())
        }
      }
    }"""

# Since line endings might be tricky, we'll try a simpler match for the cleanup
if bad_cleanup in content:
    content = content.replace(bad_cleanup, good_cleanup)
else:
    # If exact block match fails, try replacing the problematic line
    content = content.replace('if (fcmCleanup.unsubscribe) fcmCleanup.unsubscribe()', 
                              'if (fcmCleanup.unsubscribe) { const u = fcmCleanup.unsubscribe; if (typeof u === "function") u(); else if (u && typeof (u as any).then === "function") (u as any).then((h: any) => h.remove?.()); }')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully patched AppListeners.tsx")
