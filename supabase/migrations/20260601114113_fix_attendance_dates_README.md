# Attendance Date Migration

## Overview

This migration fixes attendance dates that were recorded with incorrect timezone calculations. The bug caused dates to be calculated using double `AT TIME ZONE` conversion, which resulted in date shifts.

## Files

1. **20260601114113_fix_attendance_dates_preview.sql** - Preview script to check affected records
2. **20260601114113_fix_attendance_dates.sql** - Main migration script
3. **20260601114113_fix_attendance_dates_verify.sql** - Verification script

## Migration Process

### Step 1: Preview (REQUIRED)

Run the preview script to see which records will be affected:

```bash
psql -h <host> -U <user> -d <database> -f supabase/migrations/20260601114113_fix_attendance_dates_preview.sql
```

This will show:
- List of records with incorrect dates
- Summary statistics (total affected, date range, etc.)

### Step 2: Backup (REQUIRED)

Before running the migration, create a backup:

```bash
pg_dump -h <host> -U <user> -d <database> -t shift_attendance > shift_attendance_backup_$(date +%Y%m%d).sql
```

### Step 3: Run Migration

Apply the migration:

```bash
psql -h <host> -U <user> -d <database> -f supabase/migrations/20260601114113_fix_attendance_dates.sql
```

The migration will:
1. Log sample records that will be updated
2. Count affected records
3. Update dates to match operational timezone (Asia/Makassar)
4. Verify all dates are correct
5. Raise an exception if any records still have incorrect dates

### Step 4: Verify (REQUIRED)

Run the verification script:

```bash
psql -h <host> -U <user> -d <database> -f supabase/migrations/20260601114113_fix_attendance_dates_verify.sql
```

This will:
- Count total records
- Check for any remaining incorrect dates
- Show correctness percentage
- Raise an exception if verification fails

## Expected Results

- **Before Migration**: Some records have `date` that doesn't match `(first_online_at AT TIME ZONE 'Asia/Makassar')::DATE`
- **After Migration**: All records have `date` that matches `(first_online_at AT TIME ZONE 'Asia/Makassar')::DATE`

## Rollback

If you need to rollback, restore from the backup:

```bash
psql -h <host> -U <user> -d <database> < shift_attendance_backup_YYYYMMDD.sql
```

## Related

- Spec: `.kiro/specs/timezone-date-calculation-fix/`
- Bug Report: `src/tests/timezone-bug-exploration-results.md`
- Task: 6.1 - Create migration script to fix existing wrong dates

## Safety

- Migration is idempotent (can be run multiple times safely)
- Migration includes verification step
- Migration will raise exception if verification fails
- No data is deleted, only `date` column is updated
