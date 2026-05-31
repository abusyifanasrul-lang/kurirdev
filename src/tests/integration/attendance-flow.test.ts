import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabaseClient';

/**
 * Integration Tests for Attendance System
 * 
 * These tests verify the complete attendance workflow including:
 * - Check-in flow
 * - Cron job execution
 * - Admin review workflow
 * - Fine application
 * 
 * Prerequisites:
 * - Test database with all migrations applied
 * - Test user accounts (courier, admin)
 * - Test shift configured
 */

describe('Attendance System Integration Tests', () => {
  let testCourierId: string;
  let testAdminId: string;
  let testShiftId: string;
  let testAttendanceId: string;

  beforeAll(async () => {
    // Setup test data
    // Note: In real implementation, use test database seeding
    console.log('Setting up integration test data...');
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('Cleaning up integration test data...');
  });

  beforeEach(() => {
    // Reset state before each test
  });

  describe('Complete Check-in Flow', () => {
    it('should allow courier to check in within shift window', async () => {
      // Arrange: Set up test courier and shift
      const courierId = 'test-courier-1';
      
      // Act: Call check-in RPC
      const { data, error } = await supabase.rpc('record_courier_checkin', {
        p_courier_id: courierId,
      });

      // Assert
      expect(error).toBeNull();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Check-in berhasil');
      expect(data).toHaveProperty('checked_in_at');
      expect(data).toHaveProperty('shift_name');
    });

    it('should reject check-in outside shift window', async () => {
      // Arrange: Set time outside window (mock or use test shift)
      const courierId = 'test-courier-2';
      
      // Act: Attempt check-in
      const { data, error } = await supabase.rpc('record_courier_checkin', {
        p_courier_id: courierId,
      });

      // Assert
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error', 'outside_shift_window');
      expect(data).toHaveProperty('message');
    });

    it('should prevent duplicate check-in', async () => {
      const courierId = 'test-courier-3';
      
      // First check-in
      await supabase.rpc('record_courier_checkin', {
        p_courier_id: courierId,
      });

      // Second check-in attempt
      const { data } = await supabase.rpc('record_courier_checkin', {
        p_courier_id: courierId,
      });

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error', 'already_checked_in');
    });

    it('should create shift_attendance record on successful check-in', async () => {
      const courierId = 'test-courier-4';
      const today = new Date().toISOString().split('T')[0];

      // Check-in
      await supabase.rpc('record_courier_checkin', {
        p_courier_id: courierId,
      });

      // Verify attendance record created
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('courier_id', courierId)
        .eq('date', today)
        .single();

      expect(attendance).not.toBeNull();
      expect(attendance?.status).toBe('on_time');
      expect(attendance?.first_online_at).not.toBeNull();
    });
  });

  describe('Shift Start Cron Job Flow', () => {
    it('should create attendance records for all active couriers at shift start', async () => {
      const shiftId = 'test-shift-1';

      // Execute shift start cron
      const { error } = await supabase.rpc('process_shift_start', {
        p_shift_id: shiftId,
      });

      expect(error).toBeNull();

      // Verify attendance records created
      const { data: logs } = await supabase
        .from('cron_execution_logs')
        .select('*')
        .eq('job_type', 'shift_start')
        .eq('shift_id', shiftId)
        .order('executed_at', { ascending: false })
        .limit(1);

      expect(logs).not.toBeNull();
      expect(logs?.[0]?.status).toBe('success');
      expect(logs?.[0]?.records_affected).toBeGreaterThan(0);
    });

    it('should mark online couriers as on_time', async () => {
      // Arrange: Courier already online before shift start
      const courierId = 'test-courier-5';
      await supabase
        .from('profiles')
        .update({ is_online: true })
        .eq('id', courierId);

      const shiftId = 'test-shift-1';

      // Act: Run shift start cron
      await supabase.rpc('process_shift_start', {
        p_shift_id: shiftId,
      });

      // Assert: Check attendance status
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('courier_id', courierId)
        .eq('date', today)
        .single();

      expect(attendance?.status).toBe('on_time');
      expect(attendance?.first_online_at).not.toBeNull();
    });

    it('should mark offline couriers as late', async () => {
      // Arrange: Courier offline at shift start
      const courierId = 'test-courier-6';
      await supabase
        .from('profiles')
        .update({ is_online: false })
        .eq('id', courierId);

      const shiftId = 'test-shift-1';

      // Act: Run shift start cron
      await supabase.rpc('process_shift_start', {
        p_shift_id: shiftId,
      });

      // Assert
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('courier_id', courierId)
        .eq('date', today)
        .single();

      expect(attendance?.status).toBe('late');
      expect(attendance?.first_online_at).toBeNull();
      expect(attendance?.late_minutes).toBe(0);
    });

    it('should skip couriers on day_off', async () => {
      const courierId = 'test-courier-7';
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      
      // Set courier day_off to today
      await supabase
        .from('profiles')
        .update({ day_off: today })
        .eq('id', courierId);

      const shiftId = 'test-shift-1';

      // Run shift start cron
      await supabase.rpc('process_shift_start', {
        p_shift_id: shiftId,
      });

      // Verify no attendance record created
      const todayDate = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('courier_id', courierId)
        .eq('date', todayDate)
        .single();

      expect(attendance).toBeNull();
    });

    it('should skip all couriers on holidays', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Create holiday for today
      await supabase
        .from('holidays')
        .insert({
          date: today,
          name: 'Test Holiday',
          is_active: true,
        });

      const shiftId = 'test-shift-1';

      // Run shift start cron
      await supabase.rpc('process_shift_start', {
        p_shift_id: shiftId,
      });

      // Verify log shows holiday skip
      const { data: logs } = await supabase
        .from('cron_execution_logs')
        .select('*')
        .eq('job_type', 'shift_start')
        .eq('shift_id', shiftId)
        .order('executed_at', { ascending: false })
        .limit(1);

      expect(logs?.[0]?.error_message).toContain('Holiday');
      expect(logs?.[0]?.records_affected).toBe(0);

      // Cleanup
      await supabase
        .from('holidays')
        .delete()
        .eq('date', today);
    });
  });

  describe('Shift End Cron Job Flow', () => {
    it('should mark late records without check-in as alpha', async () => {
      const shiftId = 'test-shift-1';
      const courierId = 'test-courier-8';
      const today = new Date().toISOString().split('T')[0];

      // Create late record without check-in
      await supabase
        .from('shift_attendance')
        .insert({
          courier_id: courierId,
          shift_id: shiftId,
          date: today,
          status: 'late',
          first_online_at: null,
          late_minutes: 0,
        });

      // Run shift end cron
      await supabase.rpc('process_shift_end', {
        p_shift_id: shiftId,
      });

      // Verify status changed to alpha
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('courier_id', courierId)
        .eq('date', today)
        .single();

      expect(attendance?.status).toBe('alpha');
      expect(attendance?.late_minutes).toBeGreaterThan(0);
    });

    it('should reset late_fine_active for shift couriers', async () => {
      const shiftId = 'test-shift-1';

      // Run shift end cron
      await supabase.rpc('process_shift_end', {
        p_shift_id: shiftId,
      });

      // Verify late_fine_active reset
      const { data: couriers } = await supabase
        .from('profiles')
        .select('late_fine_active')
        .eq('shift_id', shiftId)
        .eq('role', 'courier');

      couriers?.forEach(courier => {
        expect(courier.late_fine_active).toBe(false);
      });
    });
  });

  describe('Late Minutes Update Cron Flow', () => {
    it('should update late_minutes for active late records', async () => {
      const courierId = 'test-courier-9';
      const today = new Date().toISOString().split('T')[0];

      // Create late record
      await supabase
        .from('shift_attendance')
        .insert({
          courier_id: courierId,
          shift_id: 'test-shift-1',
          date: today,
          status: 'late',
          first_online_at: null,
          late_minutes: 0,
        });

      // Run update late minutes cron
      await supabase.rpc('update_late_minutes');

      // Verify late_minutes updated
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('late_minutes')
        .eq('courier_id', courierId)
        .eq('date', today)
        .single();

      expect(attendance?.late_minutes).toBeGreaterThan(0);
    });
  });

  describe('Admin Review Workflow', () => {
    it('should fetch pending review records correctly', async () => {
      const { data, error } = await supabase.rpc('get_pending_review_attendance');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      // All records should have status='late' and fine_type=NULL
      data?.forEach(record => {
        expect(record.status).toBe('late');
        expect(record.fine_type).toBeNull();
      });
    });

    it('should fetch pending alpha records correctly', async () => {
      const { data, error } = await supabase.rpc('get_pending_alpha_attendance');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      
      // All records should have status='alpha' and resolved_by=NULL
      data?.forEach(record => {
        expect(record.status).toBe('alpha');
        expect(record.resolved_by).toBeNull();
      });
    });

    it('should apply per_order fine for late < 60 minutes', async () => {
      const attendanceId = 'test-attendance-1';
      const adminId = 'test-admin-1';

      const { error } = await supabase.rpc('apply_attendance_fine', {
        p_attendance_id: attendanceId,
        p_fine_type: 'per_order',
        p_admin_id: adminId,
        p_notes: 'Test fine application',
      });

      expect(error).toBeNull();

      // Verify fine applied
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', attendanceId)
        .single();

      expect(attendance?.fine_type).toBe('per_order');
      expect(attendance?.fine_per_order).toBe(1000);
      expect(attendance?.resolved_by).toBe(adminId);
      expect(attendance?.resolved_at).not.toBeNull();
    });

    it('should apply flat_major fine for late >= 60 minutes', async () => {
      const attendanceId = 'test-attendance-2';
      const adminId = 'test-admin-1';

      const { error } = await supabase.rpc('apply_attendance_fine', {
        p_attendance_id: attendanceId,
        p_fine_type: 'flat_major',
        p_admin_id: adminId,
        p_notes: 'Major late fine',
      });

      expect(error).toBeNull();

      // Verify fine applied
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', attendanceId)
        .single();

      expect(attendance?.fine_type).toBe('flat_major');
      expect(attendance?.flat_fine).toBe(30000);
      expect(attendance?.resolved_by).toBe(adminId);
    });

    it('should excuse late attendance', async () => {
      const attendanceId = 'test-attendance-3';
      const adminId = 'test-admin-1';

      const { error } = await supabase.rpc('excuse_attendance', {
        p_attendance_id: attendanceId,
        p_admin_id: adminId,
        p_notes: 'Valid excuse',
      });

      expect(error).toBeNull();

      // Verify status changed to excused
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', attendanceId)
        .single();

      expect(attendance?.status).toBe('excused');
      expect(attendance?.resolved_by).toBe(adminId);
      expect(attendance?.notes).toBe('Valid excuse');
    });

    it('should verify alpha attendance', async () => {
      const attendanceId = 'test-attendance-4';
      const adminId = 'test-admin-1';

      const { error } = await supabase.rpc('verify_alpha_attendance', {
        p_attendance_id: attendanceId,
        p_admin_id: adminId,
        p_notes: 'Confirmed alpha',
      });

      expect(error).toBeNull();

      // Verify alpha verified
      const { data: attendance } = await supabase
        .from('shift_attendance')
        .select('*')
        .eq('id', attendanceId)
        .single();

      expect(attendance?.resolved_by).toBe(adminId);
      expect(attendance?.resolved_at).not.toBeNull();
    });
  });

  describe('Cron Job Sync Flow', () => {
    it('should sync cron jobs when shift is created', async () => {
      // Create new shift
      const { data: newShift } = await supabase
        .from('shifts')
        .insert({
          name: 'Test Shift New',
          start_time: '09:00:00',
          end_time: '18:00:00',
          is_overnight: false,
          is_active: true,
        })
        .select()
        .single();

      // Verify cron jobs created
      const { data: cronJobs } = await supabase
        .from('cron_jobs')
        .select('*')
        .eq('shift_id', newShift?.id);

      expect(cronJobs).toHaveLength(2); // start and end
      expect(cronJobs?.find(j => j.job_type === 'start')?.scheduled_time).toBe('09:00:00');
      expect(cronJobs?.find(j => j.job_type === 'end')?.scheduled_time).toBe('18:00:00');
    });

    it('should update cron jobs when shift times change', async () => {
      const shiftId = 'test-shift-1';

      // Update shift times
      await supabase
        .from('shifts')
        .update({
          start_time: '07:00:00',
          end_time: '16:00:00',
        })
        .eq('id', shiftId);

      // Verify cron jobs updated
      const { data: cronJobs } = await supabase
        .from('cron_jobs')
        .select('*')
        .eq('shift_id', shiftId);

      expect(cronJobs?.find(j => j.job_type === 'start')?.scheduled_time).toBe('07:00:00');
      expect(cronJobs?.find(j => j.job_type === 'end')?.scheduled_time).toBe('16:00:00');
    });

    it('should deactivate cron jobs when shift is deactivated', async () => {
      const shiftId = 'test-shift-2';

      // Deactivate shift
      await supabase
        .from('shifts')
        .update({ is_active: false })
        .eq('id', shiftId);

      // Verify cron jobs deactivated
      const { data: cronJobs } = await supabase
        .from('cron_jobs')
        .select('*')
        .eq('shift_id', shiftId);

      cronJobs?.forEach(job => {
        expect(job.is_active).toBe(false);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle 100+ couriers in shift start cron within 2 seconds', async () => {
      const shiftId = 'test-shift-large';
      const startTime = Date.now();

      await supabase.rpc('process_shift_start', {
        p_shift_id: shiftId,
      });

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(2000); // < 2 seconds
    });

    it('should handle 1000+ pending records in admin UI query within 5 seconds', async () => {
      const startTime = Date.now();

      await supabase.rpc('get_pending_review_attendance');

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // < 5 seconds
    });
  });
});
