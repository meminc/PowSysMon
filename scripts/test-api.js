// scripts/test-api.js
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
let authToken = '';

// Test functions
async function testHealth() {
  console.log('\n🏥 Testing Health Endpoint...');
  try {
    const response = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check passed:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.response?.data || error.message);
    return false;
  }
}

async function testLogin() {
  console.log('\n🔐 Testing Login...');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@gridmonitor.com',
      password: 'admin123'
    });
    authToken = response.data.data.tokens.access;
    console.log('✅ Login successful');
    console.log('   User:', response.data.data.user.email);
    console.log('   Role:', response.data.data.user.role);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testGetElements() {
  console.log('\n📋 Testing Get Elements...');
  try {
    const response = await axios.get(`${API_URL}/elements`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Get elements successful');
    console.log('   Total elements:', response.data.pagination.total);
    console.log('   First page count:', response.data.data.length);
    return true;
  } catch (error) {
    console.error('❌ Get elements failed:', error.response?.data || error.message);
    return false;
  }
}

async function testCreateElement() {
  console.log('\n➕ Testing Create Element...');
  try {
    const newLoad = {
      type: 'load',
      name: `Test Load ${Date.now()}`,
      description: 'Test load created by API test script',
      location: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      status: 'active',
      load_properties: {
        load_type: 'commercial',
        connection_type: 'three_phase',
        rated_power: 500,
        power_factor: 0.95,
        voltage_level: 11,
        priority: 'medium'
      }
    };

    const response = await axios.post(`${API_URL}/elements`, newLoad, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Element created successfully');
    console.log('   ID:', response.data.data.id);
    console.log('   Name:', response.data.data.name);
    return response.data.data.id;
  } catch (error) {
    console.error('❌ Create element failed:', error.response?.data || error.message);
    return null;
  }
}

async function testSubmitMeasurement(elementId) {
  console.log('\n📊 Testing Submit Measurement...');
  if (!elementId) {
    console.log('⚠️  Skipping measurement test - no element ID');
    return false;
  }

  try {
    const measurement = {
      element_id: elementId,
      measurements: {
        voltage: 10.8,
        current: 45.5,
        active_power: 450,
        reactive_power: 150,
        power_factor: 0.95,
        frequency: 50.02,
        temperature: 35.5
      }
    };

    const response = await axios.post(`${API_URL}/measurements`, measurement, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Measurement submitted successfully');
    console.log('   Successful:', response.data.data.successful);
    console.log('   Failed:', response.data.data.failed);
    return true;
  } catch (error) {
    console.error('❌ Submit measurement failed:', error.response?.data || error.message);
    return false;
  }
}

async function testLogout() {
  console.log('\n🚪 Testing Logout...');
  try {
    await axios.post(`${API_URL}/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    console.log('✅ Logout successful');
    return true;
  } catch (error) {
    console.error('❌ Logout failed:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Grid Monitoring API Tests\n');
  console.log('   API URL:', API_URL);
  console.log('   Time:', new Date().toISOString());
  console.log('='.repeat(50));

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  // Run tests in sequence
  const tests = [
    { name: 'Health Check', fn: testHealth },
    { name: 'Login', fn: testLogin },
    { name: 'Get Elements', fn: testGetElements },
    { name: 'Create Element', fn: testCreateElement },
    { name: 'Submit Measurement', fn: async () => {
      const elementId = await testCreateElement();
      return testSubmitMeasurement(elementId);
    }},
    { name: 'Logout', fn: testLogout }
  ];

  for (const test of tests) {
    results.total++;
    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      results.failed++;
      console.error(`❌ ${test.name} threw error:`, error.message);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`   Total Tests: ${results.total}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(console.error);