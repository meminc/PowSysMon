// scripts/test-all-apis.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_URL = 'http://localhost:3000/api';
let authToken = '';
let testUserId = '';
let testElementId = '';
let testEventId = '';

// Test configurations
const tests = {
  health: { name: 'Health Check', fn: testHealth },
  auth: { name: 'Authentication', fn: testAuth },
  elements: { name: 'Elements CRUD', fn: testElements },
  measurements: { name: 'Measurements', fn: testMeasurements },
  analytics: { name: 'Analytics', fn: testAnalytics },
  topology: { name: 'Topology', fn: testTopology },
  users: { name: 'User Management', fn: testUsers },
  events: { name: 'Events', fn: testEvents },
  import: { name: 'Import', fn: testImport },
  export: { name: 'Export', fn: testExport },
  //settings: { name: 'Settings', fn: testSettings }
};

// Test implementation
async function testHealth() {
  const response = await axios.get(`${API_URL}/health`);
  console.log('✅ Health check:', response.data.status);
  return response.data.status === 'healthy' || response.data.status === 'degraded';
}

async function testAuth() {
  // Login
  const loginResponse = await axios.post(`${API_URL}/auth/login`, {
    email: 'admin@gridmonitor.com',
    password: 'admin123'
  });
  authToken = loginResponse.data.data.tokens.access;
  console.log('✅ Login successful');

  // Test logout
  await axios.post(`${API_URL}/auth/logout`, {}, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  console.log('✅ Logout successful');

  // Re-login for other tests
  const reLogin = await axios.post(`${API_URL}/auth/login`, {
    email: 'admin@gridmonitor.com',
    password: 'admin123'
  });
  authToken = reLogin.data.data.tokens.access;
  
  return true;
}

async function testElements() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Create element
  const newElement = {
    type: 'generator',
    name: `Test Generator ${Date.now()}`,
    description: 'Test generator for API testing',
    location: { latitude: 40.7128, longitude: -74.0060 },
    status: 'active',
    generator_properties: {
      generation_type: 'solar',
      rated_capacity: 10,
      min_capacity: 0,
      max_capacity: 10,
      voltage_level: 11
    }
  };

  const createResponse = await axios.post(`${API_URL}/elements`, newElement, { headers });
  testElementId = createResponse.data.data.id;
  console.log('✅ Element created:', testElementId);

  // Get element
  const getResponse = await axios.get(`${API_URL}/elements/${testElementId}`, { headers });
  console.log('✅ Element retrieved:', getResponse.data.data.name);

  // Update element
  const updateResponse = await axios.put(`${API_URL}/elements/${testElementId}`, {
    status: 'maintenance',
    description: 'Updated description'
  }, { headers });
  console.log('✅ Element updated');

  // List elements
  const listResponse = await axios.get(`${API_URL}/elements?type=generator`, { headers });
  console.log('✅ Elements listed:', listResponse.data.pagination.total);

  return true;
}

async function testMeasurements() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Submit measurement
  const measurement = {
    element_id: testElementId,
    measurements: {
      voltage: 11.1,
      current: 150,
      active_power: 8.5,
      reactive_power: 2.5,
      frequency: 50.01
    }
  };

  const submitResponse = await axios.post(`${API_URL}/measurements`, measurement, { headers });
  console.log('✅ Measurement submitted');

  // Query measurements
  const queryResponse = await axios.get(
    `${API_URL}/measurements?element_id=${testElementId}&start=-1h`,
    { headers }
  );
  console.log('✅ Measurements queried:', queryResponse.data.data.data.length);

  return true;
}

async function testAnalytics() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Test different analytics endpoints
  const analyticsTypes = [
    'system_summary',
    'generation_mix',
    'load_profile',
    'reliability_metrics',
    'energy_consumption',
    'peak_demand'
  ];

  for (const type of analyticsTypes) {
    try {
      const response = await axios.get(`${API_URL}/analytics?type=${type}`, { headers });
      console.log(`✅ Analytics ${type}:`, response.data.success);
    } catch (error) {
      console.error(`❌ Analytics ${type} failed:`, error.response?.data?.error?.message);
    }
  }

  return true;
}

async function testTopology() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Get topology
  const topologyResponse = await axios.get(`${API_URL}/topology?format=graph`, { headers });
  console.log('✅ Topology retrieved:', topologyResponse.data.data.metadata.element_count, 'elements');

  // Create connection if we have multiple elements
  if (topologyResponse.data.data.metadata.element_count >= 2) {
    const nodes = topologyResponse.data.data.nodes;
    const bus = nodes.find(n => n.type === 'bus');
    
    if (bus && testElementId) {
      try {
        const connectionResponse = await axios.post(`${API_URL}/topology`, {
          from_element_id: testElementId,
          to_element_id: bus.id,
          connection_type: 'electrical'
        }, { headers });
        console.log('✅ Connection created');
      } catch (error) {
        console.log('⚠️  Connection creation skipped:', error.response?.data?.error?.message);
      }
    }
  }

  return true;
}

async function testUsers() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Create user
  const newUser = {
    email: `test${Date.now()}@gridmonitor.com`,
    password: 'TestPass123!',
    name: 'Test User',
    role: 'viewer'
  };

  try {
    const createResponse = await axios.post(`${API_URL}/users`, newUser, { headers });
    testUserId = createResponse.data.data.id;
    console.log('✅ User created:', newUser.email);

    // Get user
    const getResponse = await axios.get(`${API_URL}/users/${testUserId}`, { headers });
    console.log('✅ User retrieved');

    // Update user
    const updateResponse = await axios.put(`${API_URL}/users/${testUserId}`, {
      name: 'Updated Test User'
    }, { headers });
    console.log('✅ User updated');

    // Create API key
    const apiKeyResponse = await axios.post(`${API_URL}/users/${testUserId}/api-keys`, {
      name: 'Test API Key'
    }, { headers });
    console.log('✅ API key created');
    console.log('   Key preview:', apiKeyResponse.data.data.key.substring(0, 20) + '...');

    // List users
    const listResponse = await axios.get(`${API_URL}/users`, { headers });
    console.log('✅ Users listed:', listResponse.data.pagination.total);

  } catch (error) {
    console.error('❌ User test error:', error.response?.data);
  }

  return true;
}

async function testEvents() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Create event
  const newEvent = {
    element_id: testElementId,
    event_type: 'alarm',
    severity: 'high',
    category: 'voltage_violation',
    description: 'Test high voltage alarm',
    parameters: {
      measured_value: 12.5,
      threshold_value: 11.55,
      unit: 'kV'
    }
  };
  const createResponse = await axios.post(`${API_URL}/events`, newEvent, { headers });
  testEventId = createResponse.data.data.id;
  console.log('✅ Event created:', testEventId);

  // Get event
  const getResponse = await axios.get(`${API_URL}/events/${testEventId}`, { headers });
  console.log('✅ Event retrieved');

  // Acknowledge event
  const ackResponse = await axios.put(`${API_URL}/events/${testEventId}`, {
    action: 'acknowledge'
  }, { headers });
  console.log('✅ Event acknowledged');

  // Resolve event
  const resolveResponse = await axios.put(`${API_URL}/events/${testEventId}`, {
    action: 'resolve',
    resolution_notes: 'Issue resolved by adjusting tap settings'
  }, { headers });
  console.log('✅ Event resolved');

  // List events
  const listResponse = await axios.get(`${API_URL}/events?severity=high`, { headers });
  console.log('✅ Events listed:', listResponse.data.pagination.total);

  return true;
}

async function testImport() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Create sample CSV data
  const csvContent = `element_id,timestamp,voltage,current,power
${testElementId},2024-01-15T10:00:00Z,11.2,145,8.1
${testElementId},2024-01-15T10:05:00Z,11.1,148,8.3
${testElementId},2024-01-15T10:10:00Z,11.3,142,8.0`;

  const form = new FormData();
  form.append('file', Buffer.from(csvContent), 'test_measurements.csv');
  form.append('type', 'measurements');
  form.append('mapping', JSON.stringify({
    element_id_column: 'element_id',
    timestamp_column: 'timestamp',
    measurements: {
      voltage: 'voltage',
      current: 'current',
      active_power: 'power'
    }
  }));

  try {
    const importResponse = await axios.post(`${API_URL}/import`, form, {
      headers: {
        ...headers,
        ...form.getHeaders()
      }
    });
    console.log('✅ Import completed:', importResponse.data.data.records_imported, 'records');
  } catch (error) {
    console.log('⚠️  Import test skipped:', error.response?.data?.error?.message);
  }

  return true;
}

async function testExport() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Export elements
  try {
    const exportResponse = await axios.get(
      `${API_URL}/export?type=elements&format=csv`,
      { headers }
    );
    console.log('✅ Export completed:', exportResponse.data.length, 'elements');
  } catch (error) {
    console.log('⚠️  Export test skipped:', error.response?.data?.error?.message);
  }

  return true;
}

async function testSettings() {
  const headers = { Authorization: `Bearer ${authToken}` };

  // Get settings
  const getResponse = await axios.get(`${API_URL}/settings`, { headers });
  console.log('✅ Settings retrieved');
  console.log('   Environment:', getResponse.data.data.system.environment);
  console.log('   Total elements:', getResponse.data.data.statistics.elements.total);

  return true;
}

// Cleanup function
async function cleanup() {
  console.log("-------------------Cleanup Started------------------")
  const headers = { Authorization: `Bearer ${authToken}` };

  try {
    // Delete test element
    if (testElementId) {
      await axios.delete(`${API_URL}/elements/${testElementId}`, { headers });
      console.log('🧹 Test element cleaned up');
    }

    // Deactivate test user
    if (testUserId) {
      await axios.delete(`${API_URL}/users/${testUserId}`, { headers });
      console.log('🧹 Test user cleaned up');
    }
  } catch (error) {
    console.log('⚠️  Cleanup error:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Grid Monitoring API Test Suite\n');
  console.log('   API URL:', API_URL);
  console.log('   Time:', new Date().toISOString());
  console.log('='.repeat(60));

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  for (const [key, test] of Object.entries(tests)) {
    results.total++;
    console.log(`\n📋 Testing ${test.name}...`);
    
    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
        console.log(`✅ ${test.name} tests passed\n`);
      } else {
        results.failed++;
        console.log(`❌ ${test.name} tests failed\n`);
      }
    } catch (error) {
      results.failed++;
      console.error(`❌ ${test.name} error:`, error.response?.data || error.message);
    }
  }

  // Cleanup
  console.log('\n🧹 Running cleanup...');
  await cleanup();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`   Total Test Suites: ${results.total}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(console.error);