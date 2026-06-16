

async function test() {
  try {
    const descriptors = [new Array(128).fill(0.123)];
    const res = await fetch('http://localhost:4000/api/v1/employees/register-face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        identifier: '12345678',
        descriptors
      })
    });
    
    console.log('Status:', res.status);
    const data = await res.text();
    console.log('Response:', data);
  } catch (err) {
    console.error(err);
  }
}

test();
