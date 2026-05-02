/**
 * Script to inspect Supabase database schema
 * Run with: node scripts/inspect-database.js
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

console.log('🔑 Credentials loaded:', {
  url: supabaseUrl ? '✅' : '❌',
  key: supabaseKey ? '✅' : '❌'
});

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  console.log('🔍 Inspecting Supabase Database...\n');

  const report = {
    timestamp: new Date().toISOString(),
    tables: {},
    functions: [],
    triggers: []
  };

  try {
    // Get all tables and columns
    console.log('📊 Fetching table structures...');
    const { data: columns, error: colError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT 
            table_name,
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name NOT LIKE 'pg_%'
          ORDER BY table_name, ordinal_position;
        `
      });

    if (colError) {
      console.log('⚠️  Cannot query information_schema directly. Trying alternative approach...');
      
      // Alternative: Query specific tables we know exist
      const knownTables = [
        'profiles', 'orders', 'customers', 'settings', 'tracking_logs',
        'shifts', 'shift_attendance', 'shift_overrides', 'holidays',
        'basecamps', 'stay_qr_tokens', 'stay_attendance_logs',
        'tier_change_log', 'attendance_logs', 'notifications'
      ];

      for (const tableName of knownTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!error && data) {
            const sampleRow = data[0] || {};
            report.tables[tableName] = {
              exists: true,
              columns: Object.keys(sampleRow).map(col => ({
                name: col,
                type: typeof sampleRow[col],
                sample: sampleRow[col]
              }))
            };
            console.log(`✅ ${tableName}: ${Object.keys(sampleRow).length} columns`);
          }
        } catch (err) {
          console.log(`❌ ${tableName}: not accessible`);
        }
      }
    } else if (columns) {
      // Group columns by table
      columns.forEach(col => {
        if (!report.tables[col.table_name]) {
          report.tables[col.table_name] = { columns: [] };
        }
        report.tables[col.table_name].columns.push({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default,
          maxLength: col.character_maximum_length
        });
      });

      console.log(`✅ Found ${Object.keys(report.tables).length} tables`);
    }

    // Try to get RPC functions
    console.log('\n🔧 Checking RPC functions...');
    const knownRPCs = [
      'handle_courier_queue_sync',
      'handle_order_cancellation_priority',
      'assign_order_and_rotate',
      'rotate_courier_queue',
      'complete_order',
      'record_courier_checkin',
      'apply_attendance_fine',
      'excuse_attendance',
      'reset_daily_fine_flags',
      'process_shift_alpha',
      'get_missing_couriers',
      'verify_stay_qr',
      'revoke_stay_by_service',
      'update_stay_counter'
    ];

    for (const rpcName of knownRPCs) {
      try {
        // Try calling with minimal params to see if it exists
        const { error } = await supabase.rpc(rpcName, {});
        
        if (error) {
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            console.log(`❌ ${rpcName}: not found`);
          } else {
            console.log(`✅ ${rpcName}: exists (${error.message.substring(0, 50)}...)`);
            report.functions.push({ name: rpcName, exists: true });
          }
        } else {
          console.log(`✅ ${rpcName}: exists`);
          report.functions.push({ name: rpcName, exists: true });
        }
      } catch (err) {
        console.log(`⚠️  ${rpcName}: ${err.message.substring(0, 50)}`);
      }
    }

    // Write report to file
    const reportPath = path.join(__dirname, '..', 'temp', 'database-inspection.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📝 Report saved to: ${reportPath}`);

    // Create summary
    console.log('\n📋 SUMMARY:');
    console.log(`   Tables: ${Object.keys(report.tables).length}`);
    console.log(`   Functions: ${report.functions.length}`);
    console.log('\n✅ Inspection complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

inspectDatabase();
