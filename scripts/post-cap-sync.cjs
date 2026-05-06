#!/usr/bin/env node

/**
 * Post Capacitor Sync Script
 * Adds custom StayMonitor plugin to capacitor.plugins.json
 * Run this after: npx cap sync android
 */

const fs = require('fs');
const path = require('path');

const PLUGINS_JSON_PATH = path.join(__dirname, '../android/app/src/main/assets/capacitor.plugins.json');

const STAY_MONITOR_PLUGIN = {
  pkg: 'stay-monitor-plugin',
  classpath: 'com.kurirme.app.StayMonitorPlugin'
};

try {
  // Read existing plugins
  const pluginsJson = JSON.parse(fs.readFileSync(PLUGINS_JSON_PATH, 'utf8'));
  
  // Check if StayMonitor plugin already exists
  const exists = pluginsJson.some(p => p.classpath === STAY_MONITOR_PLUGIN.classpath);
  
  if (!exists) {
    // Add StayMonitor plugin
    pluginsJson.push(STAY_MONITOR_PLUGIN);
    
    // Write back to file
    fs.writeFileSync(PLUGINS_JSON_PATH, JSON.stringify(pluginsJson, null, '\t'));
    
    console.log('✅ StayMonitor plugin added to capacitor.plugins.json');
  } else {
    console.log('ℹ️  StayMonitor plugin already exists in capacitor.plugins.json');
  }
} catch (error) {
  console.error('❌ Failed to update capacitor.plugins.json:', error.message);
  process.exit(1);
}
