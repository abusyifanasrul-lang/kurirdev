/**
 * Script to verify detailed database schema
 * Queries:
 * 1. All columns from critical tables (profiles, orders, shift_attendance)
 * 2. RPC function signatures and definitions
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file
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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('🔍 Verifying Database Schema Details...\n');

  const report = {
    timestamp: new Date().toISOString(),
    query1_table_columns: {},
    query2_rpc_signatures: []
  };

  try {
    // QUERY 1: Get detailed column information for critical tables
    console.log('📊 QUERY 1: Fetching column details for critical tables...');
    
    const criticalTables = ['profiles', 'orders', 'shift_attendance', 'shifts', 'settings'];
    
    for (const tableName of criticalTables) {
      console.log(`\n   Checking table: ${tableName}`);
      
      // Get one row to see actual structure
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        report.query1_table_columns[tableName] = { error: error.message };
      } else {
        const sampleRow = data && data[0] ? data[0] : {};
        const columns = Object.keys(sampleRow);
        
        report.query1_table_columns[tableName] = {
          column_count: columns.length,
          columns: columns.map(col => ({
            name: col,
            type: typeof sampleRow[col],
            has_value: sampleRow[col] !== null && sampleRow[col] !== undefined,
            sample_type: Array.isArray(sampleRow[col]) ? 'array' : typeof sampleRow[col]
          }))
        };
        
        console.log(`   ✅ Found ${columns.length} columns`);
        
        // Check for specific critical columns
        const criticalColumns = {
          profiles: ['cancel_count', 'late_fine_active', 'stay_basecamp_id', 'gps_consecutive_out', 'courier_status', 'queue_joined_at', 'is_priority_recovery'],
          orders: ['fine_deducted', 'courier_id', 'status'],
          shift_attendance: ['fine_type', 'fine_per_order', 'flat_fine', 'late_minutes', 'status', 'date']
        };
        
        if (criticalColumns[tableName]) {
          const missing = criticalColumns[tableName].filter(col => !columns.includes(col));
          const found = criticalColumns[tableName].filter(col => columns.includes(col));
          
          if (found.length > 0) {
            console.log(`   ✅ Critical columns found: ${found.join(', ')}`);
          }
          if (missing.length > 0) {
            console.log(`   ⚠️  Missing columns: ${missing.join(', ')}`);
          }
        }
      }
    }

    // QUERY 2: Get RPC function signatures
    console.log('\n\n🔧 QUERY 2: Fetching RPC function signatures...');
    
    const rpcFunctions = [
      'complete_order',
      'record_courier_checkin',
      'process_shift_alpha',
      'get_missing_couriers',
      'apply_attendance_fine',
      'assign_order_and_rotate'
    ];

    for (const rpcName of rpcFunctions) {
      console.log(`\n   Checking RPC: ${rpcName}`);
      
      // Try to call with empty params to get error message with signature
      const { data, error } = await supabase.rpc(rpcName, {});
      
      if (error) {
        const errorMsg = error.message;
        
        // Parse error message to extract parameter info
        let paramInfo = 'unknown';
        if (errorMsg.includes('missing') || errorMsg.includes('required')) {
          paramInfo = errorMsg;
        } else if (errorMsg.includes('does not exist')) {
          paramInfo = 'function does not exist';
        } else {
          paramInfo = errorMsg.substring(0, 200);
        }
        
        report.query2_rpc_signatures.push({
          name: rpcName,
          exists: !errorMsg.includes('does not exist'),
          signature_hint: paramInfo
        });
        
        console.log(`   ℹ️  ${paramInfo.substring(0, 100)}`);
      } else {
        report.query2_rpc_signatures.push({
          name: rpcName,
          exists: true,
          signature_hint: 'executed successfully with empty params'
        });
        console.log(`   ✅ Executed successfully`);
      }
    }

    // Write detailed report
    const reportPath = path.join(__dirname, '..', 'temp', 'schema-verification-detailed.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n\n📝 Detailed report saved to: ${reportPath}`);

    // Create human-readable summary
    const summaryPath = path.join(__dirname, '..', 'temp', 'schema-verification-summary.txt');
    let summary = '=== DATABASE SCHEMA VERIFICATION SUMMARY ===\n\n';
    summary += `Generated: ${new Date().toISOString()}\n\n`;
    
    summary += '1. TABLE COLUMNS VERIFICATION\n';
    summary += '================================\n\n';
    
    for (const [tableName, info] of Object.entries(report.query1_table_columns)) {
      if (info.error) {
        summary += `❌ ${tableName}: ${info.error}\n\n`;
      } else {
        summary += `✅ ${tableName} (${info.column_count} columns):\n`;
        info.columns.forEach(col => {
          summary += `   - ${col.name} (${col.sample_type})\n`;
        });
        summary += '\n';
      }
    }
    
    summary += '\n2. RPC FUNCTION SIGNATURES\n';
    summary += '================================\n\n';
    
    report.query2_rpc_signatures.forEach(rpc => {
      summary += `${rpc.exists ? '✅' : '❌'} ${rpc.name}\n`;
      summary += `   ${rpc.signature_hint}\n\n`;
    });
    
    fs.writeFileSync(summaryPath, summary);
    console.log(`📝 Human-readable summary saved to: ${summaryPath}`);

    console.log('\n✅ Schema verification complete!');
    console.log('\n📋 QUICK SUMMARY:');
    console.log(`   Tables verified: ${Object.keys(report.query1_table_columns).length}`);
    console.log(`   RPC functions checked: ${report.query2_rpc_signatures.length}`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifySchema();
