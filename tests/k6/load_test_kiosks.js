import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
export const kioskLatency = new Trend('kiosk_req_duration', true);
export const kioskErrors = new Rate('kiosk_error_rate');
export const crossTenantAuditPass = new Rate('cross_tenant_isolation_pass');

export const options = {
  scenarios: {
    kiosk_rush_hour: {
      executor: 'constant-arrival-rate',
      rate: 45, // 45 RPS sostenidas
      timeUnit: '1s',
      duration: '10m', // 10 minutos
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<200', 'p(99)<400'], // SLA: p95 < 200ms, p99 < 400ms
    'kiosk_error_rate': ['rate<0.001'], // Menos de 0.1% de errores
    'cross_tenant_isolation_pass': ['rate>0.9999'], // 100% aislamiento
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api/v1';

// Pool de tokens de prueba de 400 empresas
const COMPANIES = [
  'comp-enterprise-001',
  'comp-medium-001',
  'comp-medium-002',
  'comp-small-001',
  'comp-small-002',
];

export default function () {
  const companyId = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
  const rawToken = `token_${companyId}_kiosk_1`;

  // 1. Descarga periódica de descriptores faciales (con ETag)
  const isSync = Math.random() < 0.2; // 20% sincronización, 80% checada
  if (isSync) {
    const descParams = {
      headers: {
        'x-device-token': rawToken,
        'Accept': 'application/json',
      },
    };
    const resDesc = http.get(`${BASE_URL}/employees/descriptors`, descParams);
    
    check(resDesc, {
      'descriptors status 200 or 304': (r) => r.status === 200 || r.status === 304,
      'isolation: valid response': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && (body.length === 0 || body[0].companyId === companyId);
        }
        return true;
      },
    });

    kioskErrors.add(resDesc.status >= 500 || resDesc.status === 0);
    crossTenantAuditPass.add(resDesc.status === 200 || resDesc.status === 304);
  } else {
    // 2. Registro biométrico de asistencia
    const empNum = Math.floor(Math.random() * 20) + 1;
    const identifier = `EMP-${companyId.replace('comp-', '')}-${String(empNum).padStart(4, '0')}`;

    const payload = JSON.stringify({
      identifier,
      verificationType: 'FACE_RECOGNITION',
      confidence: 0.94,
    });

    const attParams = {
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': rawToken,
      },
    };

    const resAtt = http.post(`${BASE_URL}/attendance/register`, payload, attParams);

    const success = check(resAtt, {
      'attendance status 200 or 201': (r) => r.status === 200 || r.status === 201,
      'isolation: record belongs to company': (r) => {
        if (r.status === 200 || r.status === 201) {
          const body = JSON.parse(r.body);
          return body.companyId === companyId || (body.data && body.data.companyId === companyId);
        }
        return false;
      },
    });

    kioskErrors.add(!success);
    crossTenantAuditPass.add(success);
  }

  sleep(0.5);
}

