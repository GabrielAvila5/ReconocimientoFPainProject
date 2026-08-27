require('dotenv').config();
const jwt = require('jsonwebtoken');

async function test() {
  const token = jwt.sign({ id: 1, role: 'ADMIN' }, process.env.JWT_SECRET || 'supersecret_key_for_jwt_auth_12345', { expiresIn: '1h' });
  try {
    const res = await fetch('http://localhost:4000/api/v1/reports/attendance-consolidated?startDate=2026-08-19T00:00:00.000Z&endDate=2026-08-26T23:59:59.999Z&limit=200', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const gabriel = data.data.filter(r => r.empleado.includes('Gabriel'));
    console.log('Total returned:', data.data.length);
    console.log('Gabriel found in API:', gabriel.length);
    if (gabriel.length > 0) {
      console.log('API Gabriel data:', gabriel[0]);
    }
  } catch(e) {
    console.error('API Error:', e.message);
  }
}
test();
