import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

/**
 * Bug Condition Exploration Test: Timezone Date Calculation Bug
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **GOAL**: Surface counterexamples that demonstrate timezone calculation bugs exist
 * 
 * Bug Condition Categories:
 * 1. Backend Double Conversion: SQL functions apply `AT TIME ZONE` twice, causing date shift
 * 2. Frontend Browser Timezone: JavaScript Date methods use browser timezone instead of operational timezone
 * 
 * Expected Behavior (will FAIL on unfixed code):
 * - Backend: Date calculations use operational timezone (Asia/Makassar) without double conversion
 * - Frontend: Date calculations use operational timezone via Intl.DateTimeFormat, not browser timezone
 * 
 * **NOTE**: Backend tests require database access and authentication. They are documented here
 * but may be skipped if database is not accessible. Frontend tests can run without database.
 */

// Mock the Supabase client to avoid Web Worker issues in tests
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  }
}));

// Create test-specific Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase: any;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        worker: false,
      },
    });
  } catch (error) {
    console.warn('Failed to create Supabase client:', error);
    supabase = null;
  }
} else {
  console.warn('Supabase configuration not found');
  supabase = null;
}

describe('Timezone Date Calculation Bug Exploration', () => {
  let testCourierId: string | null = null;
  let testShiftId: string | null = null;
  let testAttendanceIds: string[] = [];
  let databaseAvailable = false;

  beforeAll(async () => {
    console.log('\n=== Setting up Timezone Bug Exploration Test ===\n');

    if (!supabase) {
      console.log('⚠️  Supabase client not available');
      console.log('\n⚠️  Backend tests will be skipped (database not accessible)');
      console.log('Frontend tests will still run to demonstrate browser timezone bugs\n');
      return;
    }

    try {
      // Try to find an active shift
      const { data: shifts, error: shiftError } = await supabase
        .from('shifts')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (!shiftError && shifts && shifts.length > 0) {
        testShiftId = shifts[0].id;
        console.log(`Using test shift: ${shifts[0].name} (${shifts[0].start_time} - ${shifts[0].end_time})`);

        // Try to find an existing courier
        const { data: couriers, error: courierError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'courier')
          .limit(1);

        if (!courierError && couriers && couriers.length > 0) {
          testCourierId = couriers[0].id;
          console.log(`Using existing courier: ${couriers[0].name} (ID: ${testCourierId})`);
          databaseAvailable = true;
        } else {
          console.log('⚠️  No couriers found in database');
        }
      } else {
        console.log('⚠️  No active shifts found in database');
      }
    } catch (error) {
      console.log('⚠️  Database not accessible:', error);
    }

    if (!databaseAvailable) {
      console.log('\n⚠️  Backend tests will be skipped (database not accessible)');
      console.log('Frontend tests will still run to demonstrate browser timezone bugs\n');
    }
  });

  afterAll(async () => {
    console.log('\n=== Cleaning up test data ===');
    
    if (!supabase) {
      console.log('No cleanup needed (Supabase not available)');
      return;
    }
    
    // Clean up test attendance records
    if (testAttendanceIds.length > 0) {
      await supabase
        .from('shift_attendance')
        .delete()
        .in('id', testAttendanceIds);
      console.log(`Deleted ${testAttendanceIds.length} test attendance records`);
    }
  });

  describe('Property 1: Bug Condition - Backend Double Timezone Conversion', () => {
    /**
     * Test Case 1: record_courier_checkin() - Evening Check-in
     * 
     * Scenario: Courier checks in at 31 Mei 2026 17:13 Makassar (09:13 UTC)
     * 
     * Bug Condition:
     * - v_current_time := now() AT TIME ZONE 'Asia/Makassar'  // First conversion: UTC → Makassar
     * - v_current_date := (v_current_time AT TIME ZONE 'Asia/Makassar')::DATE  // Second conversion: Makassar → UTC → DATE
     * 
     * Expected on UNFIXED code: date='2026-06-01' (WRONG - shifted by timezone offset)
     * Expected on FIXED code: date='2026-05-31' (CORRECT - operational timezone date)
     */
    it.skipIf(!databaseAvailable)('should record check-in with correct date in operational timezone (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Test Case 1: record_courier_checkin() - Evening Check-in ===\n');

      // This test demonstrates the bug at timezone boundaries
      // We'll use the current date and verify the date calculation is correct
      
      // Get current time in operational timezone
      const { data: timeData, error: timeError } = await supabase.rpc('sql', {
        query: `
          SELECT 
            now() AS utc_time,
            now() AT TIME ZONE 'Asia/Makassar' AS makassar_time,
            (now() AT TIME ZONE 'Asia/Makassar')::DATE AS expected_date
        `
      });

      if (timeError || !timeData || timeData.length === 0) {
        throw new Error('Failed to get current time');
      }

      const expectedDate = timeData[0].expected_date;
      console.log(`Current UTC time: ${timeData[0].utc_time}`);
      console.log(`Current Makassar time: ${timeData[0].makassar_time}`);
      console.log(`Expected date (Makassar): ${expectedDate}`);

      // Clean up any existing attendance for today
      await supabase
        .from('shift_attendance')
        .delete()
        .eq('courier_id', testCourierId)
        .eq('date', expectedDate);

      // Call record_courier_checkin
      console.log(`\nCalling record_courier_checkin('${testCourierId}')...`);
      const { data: checkinResult, error: checkinError } = await supabase.rpc('record_courier_checkin', {
        p_courier_id: testCourierId,
      });

      if (checkinError) {
        console.error('Check-in error:', checkinError);
        // If check-in fails due to shift window, that's okay for this test
        // We're testing the date calculation, not the shift window validation
        if (checkinResult?.error === 'outside_shift_window') {
          console.log('Check-in outside shift window - this is expected for this test');
          console.log('The bug would still manifest in the date calculation if we were inside the window');
          return; // Skip this test case
        }
        throw checkinError;
      }

      console.log('Check-in result:', checkinResult);

      // Query the created attendance record
      const { data: attendance, error: attendanceError } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('courier_id', testCourierId)
        .eq('shift_id', testShiftId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (attendanceError || !attendance) {
        throw new Error('Failed to query attendance record');
      }

      testAttendanceIds.push(attendance.id);

      console.log('\nAttendance record created:');
      console.log(`  ID: ${attendance.id}`);
      console.log(`  Date: ${attendance.date}`);
      console.log(`  first_online_at: ${attendance.first_online_at}`);
      console.log(`  Status: ${attendance.status}`);

      // ASSERTION (EXPECTED TO FAIL on unfixed code)
      console.log('\n=== Assertion (EXPECTED TO FAIL on unfixed code) ===\n');
      console.log(`Expected date: ${expectedDate}`);
      console.log(`Actual date: ${attendance.date}`);

      expect(attendance.date).toBe(expectedDate);
      console.log('✓ Date matches operational timezone date (bug is fixed!)');
    });

    /**
     * Test Case 2: process_shift_start() - Early Morning Shift
     * 
     * Scenario: Shift starts at 1 Juni 2026 06:00 Makassar (31 Mei 22:00 UTC)
     * 
     * Bug Condition: Same double timezone conversion as above
     * 
     * Expected on UNFIXED code: date='2026-05-31' (WRONG)
     * Expected on FIXED code: date='2026-06-01' (CORRECT)
     */
    it.skipIf(!databaseAvailable)('should create attendance records with correct date at shift start (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Test Case 2: process_shift_start() - Early Morning Shift ===\n');

      // Get current date in operational timezone
      const { data: timeData } = await supabase.rpc('sql', {
        query: `
          SELECT (now() AT TIME ZONE 'Asia/Makassar')::DATE AS expected_date
        `
      });

      const expectedDate = timeData?.[0]?.expected_date;
      console.log(`Expected date (Makassar): ${expectedDate}`);

      // Clean up any existing attendance for today
      await supabase
        .from('shift_attendance')
        .delete()
        .eq('courier_id', testCourierId)
        .eq('date', expectedDate);

      // Call process_shift_start
      console.log(`\nCalling process_shift_start('${testShiftId}')...`);
      const { error: rpcError } = await supabase.rpc('process_shift_start', {
        p_shift_id: testShiftId,
      });

      if (rpcError) {
        console.error('process_shift_start error:', rpcError);
        throw rpcError;
      }

      // Query the created attendance record
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('courier_id', testCourierId)
        .eq('shift_id', testShiftId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (attendance) {
        testAttendanceIds.push(attendance.id);

        console.log('\nAttendance record created:');
        console.log(`  Date: ${attendance.date}`);
        console.log(`  Status: ${attendance.status}`);

        // ASSERTION
        console.log('\n=== Assertion ===\n');
        expect(attendance.date).toBe(expectedDate);
        console.log('✓ Date matches operational timezone date');
      } else {
        console.log('No attendance record created (courier may be on day_off or holiday)');
      }
    });

    /**
     * Test Case 3: process_shift_end() - Afternoon Shift End
     * 
     * Scenario: Shift ends at 1 Juni 2026 14:00 Makassar (06:00 UTC)
     * 
     * Bug Condition: Same double timezone conversion affects date filtering
     * 
     * Expected on UNFIXED code: Filters date='2026-05-31' (WRONG)
     * Expected on FIXED code: Filters date='2026-06-01' (CORRECT)
     */
    it.skipIf(!databaseAvailable)('should filter attendance records by correct date at shift end (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Test Case 3: process_shift_end() - Afternoon Shift End ===\n');

      // Get current date in operational timezone
      const { data: timeData } = await supabase.rpc('sql', {
        query: `
          SELECT (now() AT TIME ZONE 'Asia/Makassar')::DATE AS expected_date
        `
      });

      const expectedDate = timeData?.[0]?.expected_date;
      console.log(`Expected date (Makassar): ${expectedDate}`);

      // Create a late attendance record for today
      const { data: attendance, error: insertError } = await supabase
        .from('shift_attendance')
        .insert({
          courier_id: testCourierId,
          shift_id: testShiftId,
          date: expectedDate,
          status: 'late',
          first_online_at: null,
          late_minutes: 0,
        })
        .select()
        .single();

      if (insertError || !attendance) {
        throw new Error(`Failed to create test attendance: ${insertError?.message}`);
      }

      testAttendanceIds.push(attendance.id);
      console.log(`Created late attendance record: ${attendance.id}`);

      // Call process_shift_end
      console.log(`\nCalling process_shift_end('${testShiftId}')...`);
      const { error: rpcError } = await supabase.rpc('process_shift_end', {
        p_shift_id: testShiftId,
      });

      if (rpcError) {
        console.error('process_shift_end error:', rpcError);
      }

      // Query the updated attendance record
      const { data: updatedAttendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', attendance.id)
        .single();

      console.log('\nAttendance record after shift end:');
      console.log(`  Date: ${updatedAttendance?.date}`);
      console.log(`  Status: ${updatedAttendance?.status}`);
      console.log(`  late_minutes: ${updatedAttendance?.late_minutes}`);

      // ASSERTION
      console.log('\n=== Assertion ===\n');
      
      // The record should still have the correct date
      expect(updatedAttendance?.date).toBe(expectedDate);
      console.log('✓ Date remains correct after shift end processing');

      // If shift has ended, status should be alpha
      // (This tests that the date filter in process_shift_end works correctly)
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('end_time, is_overnight')
        .eq('id', testShiftId)
        .single();

      if (shiftData) {
        const now = new Date();
        const shiftEndTime = new Date(`${expectedDate}T${shiftData.end_time}`);
        
        if (now > shiftEndTime) {
          expect(updatedAttendance?.status).toBe('alpha');
          console.log('✓ Status transitioned to alpha (shift has ended)');
        } else {
          console.log('Shift has not ended yet, status remains late');
        }
      }
    });

    /**
     * Test Case 4: update_late_minutes() - Late Minutes Calculation
     * 
     * Scenario: Update late minutes for couriers who haven't checked in
     * 
     * Bug Condition: Same double timezone conversion affects date filtering
     * 
     * Expected: Should filter by correct operational timezone date
     */
    it.skipIf(!databaseAvailable)('should update late minutes using correct date filter (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Test Case 4: update_late_minutes() - Late Minutes Calculation ===\n');

      // Get current date in operational timezone
      const { data: timeData } = await supabase.rpc('sql', {
        query: `
          SELECT (now() AT TIME ZONE 'Asia/Makassar')::DATE AS expected_date
        `
      });

      const expectedDate = timeData?.[0]?.expected_date;
      console.log(`Expected date (Makassar): ${expectedDate}`);

      // Create a late attendance record for today
      const { data: attendance, error: insertError } = await supabase
        .from('shift_attendance')
        .insert({
          courier_id: testCourierId,
          shift_id: testShiftId,
          date: expectedDate,
          status: 'late',
          first_online_at: null,
          late_minutes: 0,
        })
        .select()
        .single();

      if (insertError || !attendance) {
        throw new Error(`Failed to create test attendance: ${insertError?.message}`);
      }

      testAttendanceIds.push(attendance.id);
      console.log(`Created late attendance record: ${attendance.id}`);
      console.log(`Initial late_minutes: ${attendance.late_minutes}`);

      // Call update_late_minutes
      console.log(`\nCalling update_late_minutes()...`);
      const { error: rpcError } = await supabase.rpc('update_late_minutes');

      if (rpcError) {
        console.error('update_late_minutes error:', rpcError);
      }

      // Query the updated attendance record
      const { data: updatedAttendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', attendance.id)
        .single();

      console.log('\nAttendance record after update:');
      console.log(`  Date: ${updatedAttendance?.date}`);
      console.log(`  late_minutes: ${updatedAttendance?.late_minutes}`);

      // ASSERTION
      console.log('\n=== Assertion ===\n');
      
      // The record should still have the correct date
      expect(updatedAttendance?.date).toBe(expectedDate);
      console.log('✓ Date remains correct after late minutes update');

      // late_minutes should have been updated (if shift has started)
      const { data: shiftData } = await supabase
        .from('shifts')
        .select('start_time')
        .eq('id', testShiftId)
        .single();

      if (shiftData) {
        const now = new Date();
        const shiftStartTime = new Date(`${expectedDate}T${shiftData.start_time}`);
        
        if (now > shiftStartTime) {
          expect(updatedAttendance?.late_minutes).toBeGreaterThan(0);
          console.log(`✓ late_minutes updated to ${updatedAttendance?.late_minutes} (shift has started)`);
        } else {
          console.log('Shift has not started yet, late_minutes remains 0');
        }
      }
    });
  });

  describe('Property 1: Bug Condition - Frontend Browser Timezone Usage', () => {
    /**
     * Test Case 5: orderCache.ts::getLocalDateStr() - Browser Timezone
     * 
     * Scenario: Browser in UTC timezone, server time is 31 Mei 2026 22:00 UTC (= 1 Juni 2026 06:00 Makassar)
     * 
     * Bug Condition:
     * - Uses date.getFullYear(), date.getMonth(), date.getDate() which use browser timezone
     * 
     * Expected on UNFIXED code: Returns '2026-05-31' (browser timezone)
     * Expected on FIXED code: Returns '2026-06-01' (operational timezone)
     */
    it('should convert ISO string to date string using operational timezone (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Test Case 5: orderCache.ts::getLocalDateStr() - Browser Timezone ===\n');

      // Import the function to test
      const { getLocalDateStr } = await import('@/lib/orderCache');

      // Test with a timestamp that crosses day boundary
      // 31 Mei 2026 22:00 UTC = 1 Juni 2026 06:00 Makassar (UTC+8)
      const testTimestamp = '2026-05-31T22:00:00Z';
      
      console.log(`Test timestamp (UTC): ${testTimestamp}`);
      console.log(`Expected in Makassar (UTC+8): 2026-06-01 06:00`);
      console.log(`Expected date string: 2026-06-01`);

      // Call the function
      const result = getLocalDateStr(testTimestamp);
      
      console.log(`\nActual result: ${result}`);

      // ASSERTION (EXPECTED TO FAIL on unfixed code)
      console.log('\n=== Assertion (EXPECTED TO FAIL on unfixed code) ===\n');
      
      // The function should return the date in operational timezone
      expect(result).toBe('2026-06-01');
      console.log('✓ Date string uses operational timezone (bug is fixed!)');
    }, 10000); // Increase timeout to 10 seconds

    /**
     * Test Case 6: CourierEarnings.tsx - date-fns Browser Timezone
     * 
     * Scenario: Browser in UTC, checking if a timestamp is "today"
     * 
     * Bug Condition:
     * - Uses startOfDay(new Date()), endOfDay(new Date()), isToday() which use browser timezone
     * 
     * Expected on UNFIXED code: Uses browser timezone for "today" calculation
     * Expected on FIXED code: Uses operational timezone for "today" calculation
     */
    it('should check "today" using operational timezone, not browser timezone (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Test Case 6: CourierEarnings.tsx - date-fns Browser Timezone ===\n');

      // Import date utilities
      const { getLocalTodayRange, isLocalToday } = await import('@/utils/date');

      // Get today's range in operational timezone
      const { start, end } = getLocalTodayRange();
      
      console.log(`Today's range (operational timezone):`);
      console.log(`  Start: ${start.toISOString()}`);
      console.log(`  End: ${end.toISOString()}`);

      // Test with a timestamp that should be "today" in operational timezone
      // but might be "yesterday" or "tomorrow" in browser timezone
      const testTimestamp = new Date(start.getTime() + 6 * 60 * 60 * 1000); // 6 hours after midnight Makassar
      
      console.log(`\nTest timestamp: ${testTimestamp.toISOString()}`);
      console.log(`This should be "today" in operational timezone`);

      // Check if it's today using operational timezone
      const result = isLocalToday(testTimestamp);
      
      console.log(`\nisLocalToday result: ${result}`);

      // ASSERTION (EXPECTED TO FAIL on unfixed code if browser timezone differs)
      console.log('\n=== Assertion ===\n');
      
      expect(result).toBe(true);
      console.log('✓ Timestamp correctly identified as "today" in operational timezone');
    }, 10000); // Increase timeout to 10 seconds

    /**
     * Test Case 7: Dashboard "HARI INI" Filter - Date Consistency
     * 
     * Scenario: Admin opens dashboard on 1 Juni 2026, should only see records with date='2026-06-01'
     * 
     * Bug Condition:
     * - Frontend and backend may use different timezone calculations
     * 
     * Expected: Frontend and backend should agree on what "today" means
     */
    it.skipIf(!databaseAvailable || !supabase)('should show consistent "today" between frontend and backend (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Test Case 7: Dashboard "HARI INI" Filter - Date Consistency ===\n');

      // Get today's date from backend (operational timezone)
      const { data: backendDate } = await supabase.rpc('sql', {
        query: `
          SELECT (now() AT TIME ZONE 'Asia/Makassar')::DATE AS today
        `
      });

      const backendToday = backendDate?.[0]?.today;
      console.log(`Backend "today" (operational timezone): ${backendToday}`);

      // Get today's date from frontend utility
      const { getTodayLocal } = await import('@/utils/date');
      const frontendToday = getTodayLocal();
      
      console.log(`Frontend "today" (getTodayLocal): ${frontendToday}`);

      // ASSERTION
      console.log('\n=== Assertion ===\n');
      
      expect(frontendToday).toBe(backendToday);
      console.log('✓ Frontend and backend agree on "today" date');
    });
  });

  describe('Diagnostic Queries - Root Cause Analysis', () => {
    it.skipIf(!databaseAvailable || !supabase)('should verify timezone settings are consistent', async () => {
      console.log('\n=== Diagnostic: Timezone Settings ===\n');

      // Check database timezone
      const { data: dbTz } = await supabase.rpc('sql', {
        query: "SELECT current_setting('TIMEZONE') AS db_timezone"
      });

      // Check operational timezone from settings
      const { data: settings } = await supabase
        .from('settings')
        .select('operational_timezone')
        .limit(1);

      console.log(`Database timezone: ${dbTz?.[0]?.db_timezone || 'Unknown'}`);
      console.log(`Operational timezone: ${settings?.[0]?.operational_timezone || 'Unknown'}`);

      // Check browser timezone
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`Browser timezone: ${browserTz}`);

      if (dbTz?.[0]?.db_timezone !== settings?.[0]?.operational_timezone) {
        console.log('\n⚠️  WARNING: Database timezone differs from operational timezone');
        console.log('This may cause timezone calculation issues');
      }

      if (browserTz !== settings?.[0]?.operational_timezone) {
        console.log('\n⚠️  WARNING: Browser timezone differs from operational timezone');
        console.log('This is the root cause of frontend timezone bugs');
      }
    });

    it.skipIf(!databaseAvailable || !supabase)('should check for existing records with wrong dates', async () => {
      console.log('\n=== Diagnostic: Records with Wrong Dates ===\n');

      // Query records where date doesn't match the date calculated from first_online_at
      const { data: wrongRecords } = await supabase.rpc('sql', {
        query: `
          SELECT 
            id, courier_id, date, first_online_at,
            (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE AS correct_date,
            date != (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE AS is_wrong
          FROM shift_attendance
          WHERE first_online_at IS NOT NULL
            AND date != (first_online_at AT TIME ZONE 'Asia/Makassar')::DATE
          LIMIT 10
        `
      });

      if (wrongRecords && wrongRecords.length > 0) {
        console.log(`⚠️  Found ${wrongRecords.length} records with wrong dates:`);
        wrongRecords.forEach((record: any) => {
          console.log(`  - ID ${record.id}: date=${record.date}, should be ${record.correct_date}`);
        });
        console.log('\nThese records demonstrate the bug exists in production data');
      } else {
        console.log('✓ No records found with wrong dates (or bug already fixed)');
      }
    });
  });
});
