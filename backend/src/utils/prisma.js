/**
 * PRISMA CLIENT CON EXTENSIÓN DE AISLAMIENTO MULTI-TENANT (FASE 2)
 * Intercepta el 100% de operaciones en los 13 modelos que contienen companyId.
 */

const { PrismaClient } = require('@prisma/client');
const { getTenantContext, TenantContextRequiredError } = require('../middlewares/tenantContext');

const globalForPrisma = global;
const basePrisma = globalForPrisma.basePrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.basePrisma = basePrisma;

const TENANT_MODELS = [
  'Department',
  'Employee',
  'AttendanceRecord',
  'Shift',
  'DepartmentShift',
  'EmployeeShift',
  'AdminUser',
  'AdminAuditLog',
  'Notification',
  'EventRequest',
  'SystemSettings',
  'Device',
  'DeviceAuthRequest'
];

const MODELS_WITH_ID_COMPANY_ID = [
  'Department',
  'Employee',
  'AttendanceRecord',
  'Shift',
  'DepartmentShift',
  'EmployeeShift',
  'AdminUser',
  'EventRequest',
  'Device'
];

function buildTenantPrisma(client) {
  return client.$extends({
    name: 'saas-multi-tenant-isolation',
    client: {
      async $queryRaw() {
        throw new Error('USO_PROHIBIDO: $queryRaw está bloqueado en modo SaaS multi-tenant para prevenir fugas de aislamiento.');
      },
      async $queryRawUnsafe() {
        throw new Error('USO_PROHIBIDO: $queryRawUnsafe está bloqueado en modo SaaS multi-tenant para prevenir fugas de aislamiento.');
      },
      async $executeRaw() {
        throw new Error('USO_PROHIBIDO: $executeRaw está bloqueado en modo SaaS multi-tenant para prevenir modificaciones cross-tenant.');
      },
      async $executeRawUnsafe() {
        throw new Error('USO_PROHIBIDO: $executeRawUnsafe está bloqueado en modo SaaS multi-tenant para prevenir modificaciones cross-tenant.');
      }
    },
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.includes(model)) {
            return query(args);
          }

          const ctx = getTenantContext();

          // 1. Sin contexto o companyId undefined
          if (!ctx || ctx.companyId === undefined) {
            // Se permite la creación anónima de solicitudes de emparejamiento por kioscos físicos no vinculados
            if (model === 'DeviceAuthRequest' && operation === 'create') {
              return query(args);
            }
            throw new TenantContextRequiredError(`Operación '${operation}' en modelo '${model}' rechazada: no hay contexto de empresa activo.`);
          }

          const cid = ctx.companyId;

          // 2. Si companyId es null:
          // Se permite para DeviceAuthRequest (kioscos en proceso de emparejamiento previo a tener empresa)
          // y para SuperAdmin operando a nivel de plataforma (companyId null)
          if (cid === null) {
            if (model === 'DeviceAuthRequest' || ctx.isSuperAdmin) {
              return query(args);
            }
            throw new TenantContextRequiredError(`Operación '${operation}' en modelo '${model}' rechazada: companyId es nulo.`);
          }

          args = args || {};

          // 3. Inyección estricta de companyId por operación
          switch (operation) {
            case 'findMany':
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'count':
            case 'aggregate':
            case 'groupBy': {
              args.where = { ...(args.where || {}), companyId: cid };
              return query(args);
            }

            case 'findUnique':
            case 'findUniqueOrThrow': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              return query(args);
            }

            case 'create': {
              args.data = { ...(args.data || {}), companyId: cid };
              return query(args);
            }

            case 'createMany': {
              if (Array.isArray(args.data)) {
                args.data = args.data.map(item => ({ ...item, companyId: cid }));
              } else if (args.data) {
                args.data = { ...args.data, companyId: cid };
              }
              return query(args);
            }

            case 'updateMany':
            case 'deleteMany': {
              args.where = { ...(args.where || {}), companyId: cid };
              return query(args);
            }

            case 'update': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              return query(args);
            }

            case 'delete': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              return query(args);
            }

            case 'upsert': {
              if (MODELS_WITH_ID_COMPANY_ID.includes(model) && args.where && args.where.id !== undefined && !args.where.id_companyId) {
                args.where = { id_companyId: { id: args.where.id, companyId: cid } };
              } else if (model === 'SystemSettings') {
                args.where = { companyId: cid };
              } else {
                args.where = { ...(args.where || {}), companyId: cid };
              }
              args.create = { ...(args.create || {}), companyId: cid };
              args.update = { ...(args.update || {}), companyId: cid };
              return query(args);
            }

            default:
              return query(args);
          }
        }
      }
    }
  });
}

const prisma = buildTenantPrisma(basePrisma);
prisma.$base = basePrisma;

module.exports = prisma;
module.exports.basePrisma = basePrisma;
module.exports.buildTenantPrisma = buildTenantPrisma;
