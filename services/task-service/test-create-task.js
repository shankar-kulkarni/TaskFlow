const http = require('http');

const payload = JSON.stringify({
  title: 'Test Task from Script',
  description: 'Testing task creation',
  status: 'TODO',
  priority: 'MEDIUM',
  project_id: 'project-1'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/tasks',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length,
    'X-Tenant-ID': 'tenant-uuid'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(payload);
req.end();
