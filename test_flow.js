const http = require('http');

async function runTest() {
const baseUrl = 'http://localhost:3002';
  let cookie = '';

  console.log('--- EHAS Smoke Test ---');

  // 1. Login as Admin
  console.log('Logging in as Admin...');
  let res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@unicross.edu.ng', password: 'password123' })
  });
  let data = await res.json();
  cookie = res.headers.get('set-cookie').split(';')[0];
  console.log('Admin login:', data);

  // 2. Add Schedule
  console.log('Adding schedule...');
  res = await fetch(`${baseUrl}/api/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ course_id: 1, exam_date: '2026-09-01', exam_time: '09:00 AM - 12:00 PM' })
  });
  data = await res.json();
  console.log('Add schedule:', data);

  // Fetch schedules to get ID
  res = await fetch(`${baseUrl}/api/schedules`, { headers: { 'Cookie': cookie } });
  data = await res.json();
  const scheduleId = data.data[0].schedule_id;
  console.log('Schedule ID:', scheduleId);

  // 3. Run Allocation
  console.log('Running allocation...');
  res = await fetch(`${baseUrl}/api/allocations/run/${scheduleId}`, {
    method: 'POST',
    headers: { 'Cookie': cookie }
  });
  data = await res.json();
  console.log('Allocation result:', data.success ? 'Success' : 'Failed', data.message);

  // 4. Logout Admin
  console.log('Logging out admin...');
  res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { 'Cookie': cookie } });
  cookie = '';

  // 5. Login as Student
  console.log('Logging in as Student 1...');
  res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@unicross.edu.ng', password: 'password123' })
  });
  data = await res.json();
  cookie = res.headers.get('set-cookie').split(';')[0];
  console.log('Student login:', data);

  // 6. Check Student Route Access Control
  console.log('Checking student trying to access admin route...');
  res = await fetch(`${baseUrl}/api/schedules`, { headers: { 'Cookie': cookie } });
  console.log('Admin route status for student:', res.status);

  // 7. Get Student Dashboard
  console.log('Fetching Student Dashboard...');
  res = await fetch(`${baseUrl}/student/dashboard`, { headers: { 'Cookie': cookie } });
  const html = await res.text();
  if (html.includes('09:00 AM - 12:00 PM')) {
    console.log('Student sees their allocation: YES');
  } else {
    console.log('Student sees their allocation: NO');
  }

}

runTest().catch(console.error);
