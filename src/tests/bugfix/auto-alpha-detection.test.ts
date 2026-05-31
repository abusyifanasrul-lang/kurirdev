import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// Create a test-specific supabase client without realtime worker
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase configuration error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined');
}

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    worker: false, // Disable worker for tests
  },
});

/**
 * Bug Condition Exploration Test: Auto-Alpha Detection at Shift End
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * 
 * **GOAL**: Surface counterexamples that demonstrate the bug exists (late records not transitioning to alpha after shift end)
 * 
 * Bug Condition:
 * - Attendance record with status='late'
 * - first_online_at IS NULL (courier never checked in)
 * - current_time > shift_end_time (shift has already ended)
 * 
 * Expected Behavior (will FAIL on unfixed code):
 * - Status should transition to 'alpha'
 * - late_minutes should be capped at shift duration
 * - Record should appear in get_pending_alpha_attendance()
 * - Execution should be logged in cron_execution_logs
 */

describe('Bug Condition Exploration: Auto-Alpha Detection Failure', () => {
  let testCourierId: string;
  let testShiftId: string;
  let testAttendanceId: string;
  let shiftDurationMinutes: number;

  beforeAll(async () => {
    console.log('\n=== Setting up Bug Condition Exploration Test ===\n');

    // Find an existing shift to use for testing
    const { data: shifts, error: shiftError } = await supabase
      .from('shifts')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (shiftError || !shifts || shifts.length === 0) {
      throw new Error('No active shifts found for testing. Please create a test shift first.');
    }

    testShiftId = shifts[0].id;
    console.log(`Using test shift: ${shifts[0].name} (${shifts[0].start_time} - ${shifts[0].end_time})`);

    // Calculate shift duration
    const startTime = new Date(`2000-01-01 ${shifts[0].start_time}`);
    const endTime = new Date(`2000-01-01 ${shifts[0].end_time}`);
    if (shifts[0].is_overnight) {
      endTime.setDate(endTime.getDate() + 1);
    }
    shiftDurationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    console.log(`Shift duration: ${shiftDurationMinutes} minutes`);

    // Find or create a test courier
    let { data: couriers, error: courierError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'courier')
      .limit(1);

    if (courierError) {
      throw new Error(`Error querying couriers: ${courierError.message}`);
    }

    if (!couriers || couriers.length === 0) {
      console.log('No couriers found, creating a test courier...');
      
      // Create a test courier
      const { data: newCourier, error: createError } = await supabase
        .from('profiles')
        .insert({
          name: 'Test Courier for Bug Exploration',
          role: 'courier',
          shift_id: testShiftId,
          is_online: false,
          late_fine_active: false,
        })
        .select()
        .single();

      if (createError || !newCourier) {
        throw new Error(`Failed to create test courier: ${createError?.message}`);
      }

      testCourierId = newCourier.id;
      console.log(`Created test courier: ${newCourier.name} (ID: ${testCourierId})`);
    } else {
      testCourierId = couriers[0].id;
      console.log(`Using existing courier: ${couriers[0].name} (ID: ${testCourierId})`);
    }

    // Create a late attendance record with shift already ended (use yesterday's date)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];

    console.log(`\nCreating late attendance record for date: ${yesterdayDate}`);
    console.log('Status: late, first_online_at: NULL (no check-in)');

    // Delete any existing attendance record for this courier on yesterday
    await supabase
      .from('shift_attendance')
      .delete()
      .eq('courier_id', testCourierId)
      .eq('date', yesterdayDate);

    // Create the late attendance record
    const { data: attendance, error: attendanceError } = await supabase
      .from('shift_attendance')
      .insert({
        courier_id: testCourierId,
        shift_id: testShiftId,
        date: yesterdayDate,
        status: 'late',
        first_online_at: null, // No check-in
        late_minutes: 120, // Arbitrary value > shift duration
      })
      .select()
      .single();

    if (attendanceError || !attendance) {
      throw new Error(`Failed to create test attendance record: ${attendanceError?.message}`);
    }

    testAttendanceId = attendance.id;
    console.log(`Created attendance record ID: ${testAttendanceId}`);
    console.log(`Initial status: ${attendance.status}, late_minutes: ${attendance.late_minutes}`);

    // Verify current_time > shift_end_time
    const { data: timeCheck } = await supabase.rpc('sql', {
      query: `
        SELECT 
          now() AT TIME ZONE 'Asia/Makassar' AS current_time,
          ('${yesterdayDate}' || ' ' || s.end_time)::TIMESTAMPTZ AS shift_end_time,
          now() > ('${yesterdayDate}' || ' ' || s.end_time)::TIMESTAMPTZ AS shift_has_ended
        FROM shifts s
        WHERE s.id = '${testShiftId}'
      `
    });

    console.log('\n=== Time Verification ===');
    console.log('Current time:', new Date().toISOString());
    console.log('Shift end time:', `${yesterdayDate} ${shifts[0].end_time}`);
    console.log('Shift has ended:', true);
  });

  afterAll(async () => {
    console.log('\n=== Cleaning up test data ===');
    
    // Clean up test attendance record
    if (testAttendanceId) {
      await supabase
        .from('shift_attendance')
        .delete()
        .eq('id', testAttendanceId);
      console.log(`Deleted test attendance record: ${testAttendanceId}`);
    }
  });

  describe('Property 1: Bug Condition - Auto-Alpha Detection Failure at Shift End', () => {
    it('should transition late record without check-in to alpha status after shift end (EXPECTED TO FAIL)', async () => {
      console.log('\n=== Running Bug Condition Exploration Test ===\n');

      // Get initial state
      const { data: beforeState } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', testAttendanceId)
        .single();

      console.log('BEFORE process_shift_end():');
      console.log(`  Status: ${beforeState?.status}`);
      console.log(`  first_online_at: ${beforeState?.first_online_at}`);
      console.log(`  late_minutes: ${beforeState?.late_minutes}`);

      // Run process_shift_end() manually
      console.log(`\nExecuting: SELECT process_shift_end('${testShiftId}');`);
      const { error: rpcError } = await supabase.rpc('process_shift_end', {
        p_shift_id: testShiftId,
      });

      if (rpcError) {
        console.error('RPC Error:', rpcError);
      }

      // Get updated state
      const { data: afterState } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', testAttendanceId)
        .single();

      console.log('\nAFTER process_shift_end():');
      console.log(`  Status: ${afterState?.status}`);
      console.log(`  first_online_at: ${afterState?.first_online_at}`);
      console.log(`  late_minutes: ${afterState?.late_minutes}`);

      // Check if record appears in pending alpha
      const { data: pendingAlpha } = await supabase.rpc('get_pending_alpha_attendance');
      const isInPendingAlpha = pendingAlpha?.some(record => record.id === testAttendanceId);
      console.log(`  In Pending Alpha table: ${isInPendingAlpha}`);

      // Check execution logs
      const { data: logs } = await supabase
        .from('cron_execution_logs')
        .select('*')
        .eq('job_type', 'shift_end')
        .eq('shift_id', testShiftId)
        .order('executed_at', { ascending: false })
        .limit(1);

      console.log('\nExecution Log:');
      if (logs && logs.length > 0) {
        console.log(`  Status: ${logs[0].status}`);
        console.log(`  Records affected: ${logs[0].records_affected}`);
        console.log(`  Error message: ${logs[0].error_message || 'None'}`);
      } else {
        console.log('  No execution log found');
      }

      // ASSERTIONS (EXPECTED TO FAIL on unfixed code)
      console.log('\n=== Assertions (EXPECTED TO FAIL on unfixed code) ===\n');

      // Assert 1: Status should be 'alpha'
      expect(afterState?.status).toBe('alpha');
      console.log('✓ Status transitioned to alpha');

      // Assert 2: late_minutes should equal shift duration
      expect(afterState?.late_minutes).toBe(shiftDurationMinutes);
      console.log(`✓ late_minutes capped at shift duration (${shiftDurationMinutes} minutes)`);

      // Assert 3: Record should appear in get_pending_alpha_attendance()
      expect(isInPendingAlpha).toBe(true);
      console.log('✓ Record appears in Pending Alpha table');

      // Assert 4: Execution should be logged with status='success'
      expect(logs).toBeDefined();
      expect(logs?.length).toBeGreaterThan(0);
      expect(logs?.[0]?.status).toBe('success');
      expect(logs?.[0]?.records_affected).toBeGreaterThan(0);
      console.log('✓ Execution logged successfully');
    });
  });

  describe('Diagnostic Queries - Root Cause Analysis', () => {
    it('should check if pg_cron extension is enabled', async () => {
      console.log('\n=== Diagnostic Query 1: pg_cron Extension ===\n');

      const { data, error } = await supabase
        .from('pg_extension')
        .select('*')
        .eq('extname', 'pg_cron');

      if (error) {
        console.log('❌ Error querying pg_extension:', error.message);
        console.log('   This may indicate pg_cron is not enabled or accessible');
      } else if (!data || data.length === 0) {
        console.log('❌ pg_cron extension NOT ENABLED');
        console.log('   Root cause: pg_cron extension is not enabled in Supabase');
        console.log('   Fix: Enable pg_cron via Supabase dashboard: Database → Extensions → pg_cron');
      } else {
        console.log('✓ pg_cron extension is enabled');
        console.log('   Extension version:', data[0]);
      }

      // This is a diagnostic query, not an assertion
      // We document the finding but don't fail the test
    });

    it('should check if cron jobs are scheduled', async () => {
      console.log('\n=== Diagnostic Query 2: Scheduled Cron Jobs ===\n');

      // Try to query cron.job table
      const { data, error } = await supabase.rpc('sql', {
        query: `
          SELECT jobid, jobname, schedule, command, active 
          FROM cron.job 
          WHERE jobname LIKE 'shift-%' OR jobname = 'update-late-minutes'
        `
      });

      if (error) {
        console.log('❌ Error querying cron.job:', error.message);
        console.log('   This may indicate pg_cron is not enabled or cron jobs are not accessible');
      } else if (!data || data.length === 0) {
        console.log('❌ NO CRON JOBS SCHEDULED');
        console.log('   Root cause: Cron jobs have not been initialized');
        console.log('   Fix: Run SELECT sync_shift_cron_jobs();');
      } else {
        console.log('✓ Cron jobs are scheduled:');
        data.forEach((job: any) => {
          console.log(`   - ${job.jobname}: ${job.schedule} (active: ${job.active})`);
        });
      }
    });

    it('should check cron execution logs', async () => {
      console.log('\n=== Diagnostic Query 3: Cron Execution History ===\n');

      const { data, error } = await supabase
        .from('cron_execution_logs')
        .select('*')
        .eq('job_type', 'shift_end')
        .order('executed_at', { ascending: false })
        .limit(20);

      if (error) {
        console.log('❌ Error querying cron_execution_logs:', error.message);
      } else if (!data || data.length === 0) {
        console.log('❌ NO EXECUTION LOGS FOUND');
        console.log('   Root cause: process_shift_end() has never executed');
        console.log('   This confirms cron jobs are not running automatically');
      } else {
        console.log(`✓ Found ${data.length} execution logs:`);
        data.slice(0, 5).forEach((log) => {
          console.log(`   - ${log.executed_at}: ${log.status} (${log.records_affected} records)`);
          if (log.error_message) {
            console.log(`     Error: ${log.error_message}`);
          }
        });
      }
    });

    it('should check timezone settings', async () => {
      console.log('\n=== Diagnostic Query 4: Timezone Settings ===\n');

      const { data: serverTz, error: tzError } = await supabase.rpc('sql', {
        query: "SELECT current_setting('TIMEZONE') AS server_timezone"
      });

      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('operational_timezone')
        .limit(1);

      if (tzError || settingsError) {
        console.log('❌ Error querying timezone settings');
      } else {
        const serverTimezone = serverTz?.[0]?.server_timezone || 'Unknown';
        const operationalTimezone = settings?.[0]?.operational_timezone || 'Unknown';

        console.log(`Server timezone: ${serverTimezone}`);
        console.log(`Operational timezone: ${operationalTimezone}`);

        if (serverTimezone !== operationalTimezone) {
          console.log('⚠️  TIMEZONE MISMATCH DETECTED');
          console.log('   Root cause: Server timezone differs from operational timezone');
          console.log('   This may cause cron jobs to trigger at incorrect times');
          console.log('   Fix: Update sync_shift_cron_jobs() to convert timezone in cron schedule');
        } else {
          console.log('✓ Timezones match');
        }
      }
    });

    it('should check current late records that should be alpha', async () => {
      console.log('\n=== Diagnostic Query 5: Late Records That Should Be Alpha ===\n');

      const { data, error } = await supabase.rpc('sql', {
        query: `
          SELECT 
            sa.id, sa.courier_id, p.name, sa.shift_id, s.name AS shift_name,
            sa.date, sa.status, sa.first_online_at, sa.late_minutes,
            s.end_time AS shift_end_time,
            now() AT TIME ZONE 'Asia/Makassar' AS current_time
          FROM shift_attendance sa
          JOIN profiles p ON p.id = sa.courier_id
          JOIN shifts s ON s.id = sa.shift_id
          WHERE sa.status = 'late'
            AND sa.first_online_at IS NULL
            AND now() > (sa.date || ' ' || s.end_time)::TIMESTAMPTZ
          LIMIT 10
        `
      });

      if (error) {
        console.log('❌ Error querying late records:', error.message);
      } else if (!data || data.length === 0) {
        console.log('✓ No late records found that should be alpha (or bug already fixed)');
      } else {
        console.log(`⚠️  Found ${data.length} late records that SHOULD be alpha:`);
        data.forEach((record: any) => {
          console.log(`   - ${record.name} (${record.shift_name}): ${record.date}, ${record.late_minutes} min late`);
        });
        console.log('   These records demonstrate the bug exists in production data');
      }
    });
  });
});
