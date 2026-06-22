async function main() {
  const baseURL = 'https://review-engineapi-production.up.railway.app/api/v1';
  console.log(`Pinging live Railway health check: ${baseURL}/health ...`);
  try {
    const res = await fetch(`${baseURL}/health`);
    const data = await res.json();
    console.log(`Health check completed with status ${res.status}:`, data);
  } catch (err: any) {
    console.error('Health check failed! Message:', err.message);
  }

  const testEmail = `diagnostic-${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testName = 'Diagnostic Tester';

  console.log(`\nAttempting registration: ${baseURL}/auth/register with email ${testEmail}...`);
  try {
    const res = await fetch(`${baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        name: testName,
        password: testPassword,
      }),
    });
    const data = await res.json();
    console.log(`Registration completed with status ${res.status}:`, data);
  } catch (err: any) {
    console.error('Registration failed! Message:', err.message);
  }

  console.log(`\nAttempting login: ${baseURL}/auth/login...`);
  try {
    const res = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const data = await res.json();
    console.log(`Login completed with status ${res.status}:`, data);
  } catch (err: any) {
    console.error('Login failed! Message:', err.message);
  }
}

main().catch(console.error);
