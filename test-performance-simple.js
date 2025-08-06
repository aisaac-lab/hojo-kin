#!/usr/bin/env node

const http = require('http');

// Test simple message that should skip validation
const testMessage = "補助金とは何ですか？";

// Create request data
const postData = new URLSearchParams({
  message: testMessage,
  threadId: '',
  userId: 'test-user',
  filters: JSON.stringify({})
}).toString();

console.log('Testing API performance with simple query...');
console.log(`Message: ${testMessage}`);
console.log('---');

const startTime = Date.now();

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000;
    
    console.log(`Response received in: ${responseTime.toFixed(2)} seconds`);
    console.log(`Status Code: ${res.statusCode}`);
    
    try {
      const response = JSON.parse(data);
      if (response.error) {
        console.log('Error:', response.error);
      } else {
        console.log('Success:', response.success);
        console.log('Response length:', response.messages?.[0]?.length || 0, 'characters');
        
        // Check if validation was skipped
        if (!response.messages?.[0]?.includes('申請可能な補助金は')) {
          console.log('✓ Response does NOT contain subsidy listings (should skip validation)');
        }
      }
    } catch (e) {
      console.log('Failed to parse response:', e.message);
      console.log('Raw response:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();