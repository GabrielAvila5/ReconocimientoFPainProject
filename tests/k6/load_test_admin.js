import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const adminLatency = new Trend('admin_req_duration', true);
export const reportLatency = new Trend('report_req_duration', true);
export const adminErrors = new Rate('admin_error_rate');
export const isolationAuditPass = new Rate('admin_isolation_audit_pass');

export const options = {
  scenarios: {
    admin_operations: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '1m', target: 10 }, // Rampa hasta 10 administradores concurrentes
        { duration: '5m', target: 10 }, // 5 minutos sostenidos
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'admin_req_duration': ['p(95)<300'], // Consultas normales < 300ms
    'report_req_duration': ['p(95)<500'], // Reportes consolidados sobre 3M filas < 500ms
    'admin_error_rate': ['rate<0.001'], // Menos de 0.1% de errores
    'admin_isolation_audit_pass': ['rate>0.9999'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api/v1';
const ADMIN_JWT = __ENV.ADMIN_JWT || 'test-admin-jwt-token';
const ENTERPRISE_COMPANY_ID = 'comp-enterprise-001';

export default function () {
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${ADMIN_JWT}`,
      'Accept': 'application/json',
    },
  };

  const rand = Math.random();

  if (rand < 0.6) {
    // 60% Consultas paginadas de asistencias en Enterprise (2,000 empleados)
    const page = Math.floor(Math.random() * 5) + 1;
    const resAtt = http.get(`${BASE_URL}/attendance?page=${page}&limit=50&date=2026-10-25`, authHeaders);
    
    const ok = check(resAtt, {
      'attendance query status 200': (r) => r.status === 200,
      'attendance data isolated': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          const list = Array.isArray(body) ? body : (body.data || body.records || []);
          return list.every((item) => item.companyId === ENTERPRISE_COMPANY_ID);
        }
        return false;
      },
    });

    adminErrors.add(!ok);
    isolationAuditPass.add(ok);
    adminLatency.add(resAtt.timings.duration);

  } else if (rand < 0.85) {
    // 25% Consulta de directorio de empleados con filtrado por departamento
    const deptId = Math.floor(Math.random() * 5) + 1;
    const resEmp = http.get(`${BASE_URL}/employees?departmentId=${deptId}&limit=50`, authHeaders);

    const ok = check(resEmp, {
      'employees query status 200': (r) => r.status === 200,
      'employees data isolated': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          const list = Array.isArray(body) ? body : (body.employees || []);
          return list.every((item) => item.companyId === ENTERPRISE_COMPANY_ID);
        }
        return false;
      },
    });

    adminErrors.add(!ok);
    isolationAuditPass.add(ok);
    adminLatency.add(resEmp.timings.duration);

  } else {
    // 15% Reporte consolidado de asistencia por rango de fechas (3M registros en tabla)
    const resRep = http.get(
      `${BASE_URL}/reports/attendance-consolidated?startDate=2026-08-01&endDate=2026-10-25`,
      authHeaders
    );

    const ok = check(resRep, {
      'report query status 200': (r) => r.status === 200,
      'report data isolated': (r) => {
        if (r.status === 200) {
          const body = JSON.parse(r.body);
          // Verificar que ningún dato ajeno aparezca en el reporte
          return body.companyId === undefined || body.companyId === ENTERPRISE_COMPANY_ID;
        }
        return false;
      },
    });

    adminErrors.add(!ok);
    isolationAuditPass.add(ok);
    reportLatency.add(resRep.timings.duration);
  }

  sleep(1);
}

