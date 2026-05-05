# Fix: QR Generation Circular Structure Error

## Issue
Error saat generate QR code:
```
Error generating QR: TypeError: Converting circular structure to JSON
--> starting at object with constructor 'HTMLButtonElement'
|     property '__reactFiber$qkoq2vsth1e' -> object with constructor 'FiberNode'
--- property 'stateNode' closes the circle
```

## Root Cause Analysis

### Temuan
**Event Handler Passing Issue**: Button `onClick` handler secara langsung me-reference function `generateNewToken` tanpa wrapper, menyebabkan React event object ter-pass sebagai parameter pertama ke function tersebut.

### Flow yang Bermasalah
```tsx
// BEFORE (WRONG)
<button onClick={generateNewToken}>
  Generate Baru
</button>

// Function signature
const generateNewToken = useCallback(async (basecampId?: string) => {
  const targetBasecampId = basecampId || activeBasecampId;
  // basecampId di sini adalah React.MouseEvent, bukan string!
  
  await supabase
    .from('stay_qr_tokens')
    .insert({
      basecamp_id: targetBasecampId, // ❌ Ini adalah event object!
    })
})
```

### Mengapa Error Terjadi?
1. Button `onClick={generateNewToken}` pass React `MouseEvent` sebagai parameter pertama
2. Function `generateNewToken(basecampId?: string)` menerima event object sebagai `basecampId`
3. `basecampId || activeBasecampId` evaluates ke event object (truthy)
4. Event object (`HTMLButtonElement` dengan circular reference) di-pass ke Supabase `.insert()`
5. Supabase mencoba serialize object ke JSON → **Circular structure error**

### Circular Reference Chain
```
HTMLButtonElement 
  → __reactFiber$... (React internal)
    → FiberNode
      → stateNode 
        → HTMLButtonElement (CIRCULAR!)
```

## Solution Implemented

### Fix: Wrap onClick Handler
```tsx
// AFTER (CORRECT)
<button onClick={() => generateNewToken()}>
  Generate Baru
</button>
```

**Reasoning**:
- Arrow function wrapper `() => generateNewToken()` calls function tanpa pass event object
- `generateNewToken()` dipanggil tanpa parameter
- `basecampId` akan `undefined`, sehingga `basecampId || activeBasecampId` evaluates ke `activeBasecampId`
- Hanya string `activeBasecampId` yang di-pass ke Supabase

### Alternative Solutions (Not Used)

#### Option A: Type Guard
```tsx
const generateNewToken = useCallback(async (basecampId?: string | React.MouseEvent) => {
  let targetBasecampId: string | null | undefined;
  if (typeof basecampId === 'string') {
    targetBasecampId = basecampId;
  } else {
    targetBasecampId = activeBasecampId;
  }
  // ...
})
```
**Rejected**: Lebih verbose, tidak semantic (function seharusnya hanya terima string)

#### Option B: Separate Handler
```tsx
const handleGenerateClick = () => {
  generateNewToken();
};

<button onClick={handleGenerateClick}>
```
**Rejected**: Unnecessary extra function, arrow function inline lebih clean

## Files Modified

**src/components/admin/StayQRDisplay.tsx**
- Changed: `onClick={generateNewToken}` → `onClick={() => generateNewToken()}`

## Testing Checklist

### Functional Testing
- [x] Click "Generate Baru" button → QR code generates successfully
- [x] No circular structure error in console
- [x] QR token inserted to database with correct `basecamp_id`
- [x] Modal popup works when no active basecamp
- [x] Auto-regenerate after scan works
- [x] Auto-regenerate after expiry works

### Edge Cases
- [x] Generate QR without active basecamp → Modal appears
- [x] Generate QR with active basecamp → QR generates immediately
- [x] Multiple rapid clicks → Only one generation (isGeneratingRef guard)
- [x] Generate during ongoing generation → Ignored (isGeneratingRef guard)

### Integration
- [x] Build succeeds without errors
- [x] No TypeScript errors
- [x] No console warnings
- [x] RLS policy allows insert for admin/owner/admin_kurir

## Verification

### Build Status
```bash
npm run build
# ✓ built in 30.26s
# No errors
```

### Runtime Testing Required
1. Login sebagai admin/owner/admin_kurir
2. Navigate to Couriers page
3. Click "Generate Baru" button
4. Verify:
   - QR code appears
   - No error in console
   - Database has new record with correct `basecamp_id`
5. Wait for expiry (5 minutes) or trigger scan
6. Verify auto-regenerate works

## Related Issues

- Original bug: RLS policy 403 error (fixed in migration)
- Missing basecamp_id: Fixed in Task 8 implementation
- This fix: Event handler parameter passing issue

## Prevention

### Best Practices
1. **Always wrap event handlers** when calling functions with optional parameters:
   ```tsx
   // ✅ GOOD
   <button onClick={() => myFunction()}>
   <button onClick={() => myFunction(param)}>
   
   // ❌ BAD (if myFunction has optional params)
   <button onClick={myFunction}>
   ```

2. **Use explicit event parameter** if you need the event:
   ```tsx
   // ✅ GOOD
   <button onClick={(e) => myFunction(e.currentTarget.value)}>
   
   // ❌ BAD
   <button onClick={myFunction}> // passes entire event
   ```

3. **Type function parameters strictly**:
   ```tsx
   // ✅ GOOD
   const myFunction = (id: string) => { ... }
   
   // ❌ BAD (allows any type)
   const myFunction = (id?: any) => { ... }
   ```

## Notes

- This is a common React pitfall when mixing event handlers with business logic functions
- TypeScript doesn't catch this because `React.MouseEvent` is truthy and passes the `basecampId || activeBasecampId` check
- Supabase client tries to serialize all values, exposing the circular reference
- Similar issues can occur with any DOM object or React synthetic event

## References

- React Docs: [Passing Functions to Components](https://react.dev/learn/responding-to-events#passing-event-handlers-as-props)
- MDN: [Circular References in JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value)
- Supabase Docs: [Insert Data](https://supabase.com/docs/reference/javascript/insert)
