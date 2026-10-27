/**
 * PRISMA CLIENT CON EXTENSIÓN DE AISLAMIENTO MULTI-TENANT (FASE 2 / GATE 3A)
 * Intercepta el 100% de operaciones en los 13 modelos que contienen companyId.
 * Bloquea consultas raw no tipadas, inyecta filtros y sanitiza escrituras anidadas.
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
  'AdminUser',
  'Device',
  'Notification',
  'EventRequest'
];

/**
 * Sanitiza escrituras anidadas (nested writes) para garantizar que cualquier
 * relación anidada (create, createMany, connect, connectOrCreate) quede vinculada
 * exclusivamente a la empresa activa del inquilino (cid).
 */
function sanitizeNestedWrites(data, companyId) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeNestedWrites(item, companyId));
  }

  const sanitized = { ...data };
  for (const [key, value] of Object.entries(sanitized)) {
    if (value && typeof value === 'object') {
      // 1. Verificación y sanitización en nested create
      if ('create' in value) {
        const checkItem = (c) => {
          if (c && typeof c === 'object') {
            if (c.companyId && c.companyId !== companyId) {
              throw new Error(`CROSS_TENANT_WRITE_DETECTED: Intento de escritura anidada con companyId '${c.companyId}' ajeno al inquilino activo '${companyId}'.`);
            }
            return sanitizeNestedWrites(c, companyId);
          }
          return c;
        };

        if (Array.isArray(value.create)) {
          value.create = value.create.map(checkItem);
        } else if (value.create && typeof value.create === 'object') {
          value.create = checkItem(value.create);
        }
      }

      // 2. Verificación en nested createMany
      if ('createMany' in value && value.createMany?.data) {
        const checkManyItem = (c) => {
          if (c && typeof c === 'object') {
            if (c.companyId && c.companyId !== companyId) {
              throw new Error(`CROSS_TENANT_WRITE_DETECTED: Intento de createMany anidado con companyId '${c.companyId}' ajeno al inquilino activo '${companyId}'.`);
            }
            return { ...sanitizeNestedWrites(c, companyId), companyId };
          }
          return c;
        };

        if (Array.isArray(value.createMany.data)) {
          value.createMany.data = value.createMany.data.map(checkManyItem);
        } else if (typeof value.createMany.data === 'object') {
          value.createMany.data = checkManyItem(value.createMany.data);
        }
      }

      // 3. Validación y transformación de connect a clave compuesta id_companyId
      if ('connect' in value && value.connect && typeof value.connect === 'object') {
        if (value.connect.id !== undefined && !value.connect.id_companyId) {
          value.connect = { id_companyId: { id: value.connect.id, companyId } };
        }
      }

      // 4. Validación de connectOrCreate
      if ('connectOrCreate' in value && value.connectOrCreate) {
        if (Array.isArray(value.connectOrCreate)) {
          value.connectOrCreate = value.connectOrCreate.map(item => {
            const where = (item.where?.id !== undefined && !item.where?.id_companyId)
              ? { id_companyId: { id: item.where.id, companyId } }
              : item.where;
            if (item.create?.companyId && item.create.companyId !== companyId) {
              throw new Error(`CROSS_TENANT_WRITE_DETECTED: Intento de connectOrCreate con companyId ajeno.`);
            }
            return {
              ...item,
              where,
              create: sanitizeNestedWrites(item.create, companyId)
            };
          });
        } else if (typeof value.connectOrCreate === 'object') {
          const where = (value.connectOrCreate.where?.id !== undefined && !value.connectOrCreate.where?.id_companyId)
            ? { id_companyId: { id: value.connectOrCreate.where.id, companyId } }
            : value.connectOrCreate.where;
          if (value.connectOrCreate.create?.companyId && value.connectOrCreate.create.companyId !== companyId) {
            throw new Error(`CROSS_TENANT_WRITE_DETECTED: Intento de connectOrCreate con companyId ajeno.`);
          }
          value.connectOrCreate = {
            ...value.connectOrCreate,
            where,
            create: sanitizeNestedWrites(value.connectOrCreate.create, companyId)
          };
        }
      }
    }
  }

  return sanitized;
}

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
            throw new TenantContextRequiredError(`Operación '${operation}' en modelo '${model}' rechazada: no hay contexto de empresa activo.`);
          }

          const cid = ctx.companyId;

          // 2. Si companyId es null:
          // Solo permitido para SuperAdmin operando a nivel de plataforma global
          if (cid === null) {
            if (ctx.isSuperAdmin) {
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
              args.data = sanitizeNestedWrites(args.data, cid);
              return query(args);
            }

            case 'createMany': {
              if (Array.isArray(args.data)) {
                args.data = args.data.map(item => ({ ...sanitizeNestedWrites(item, cid), companyId: cid }));
              } else if (args.data) {
                args.data = { ...sanitizeNestedWrites(args.data, cid), companyId: cid };
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
              if (args.data) {
                args.data = sanitizeNestedWrites(args.data, cid);
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
              args.create = { ...sanitizeNestedWrites(args.create || {}, cid), companyId: cid };
              args.update = sanitizeNestedWrites(args.update || {}, cid);
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

module.exports = prisma;
module.exports.buildTenantPrisma = buildTenantPrisma;
