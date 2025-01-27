import { createLogger, format, transports } from 'winston';

function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
    }
    return value;
  };
}

function sanitizeLogData(meta, depth = 0) {
  // Evitar recursión infinita
  if (depth > 3 || !meta || typeof meta !== 'object') {
    return meta;
  }

  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];

  // Si es un array, mapear cada elemento
  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeLogData(item, depth + 1));
  }

  // Para objetos
  const sanitized = { ...meta };
  for (const key in sanitized) {
    if (!sanitized.hasOwnProperty(key)) continue;

    if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key], depth + 1);
    }
  }

  return sanitized;
}

function createCustomLogger(component, emoji) {
  return createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      format.printf(({ timestamp, level, message, ...meta }) => {
        try {
          const sanitizedMeta = sanitizeLogData(meta);
          const metaStr = Object.keys(sanitizedMeta).length
            ? JSON.stringify(sanitizedMeta, getCircularReplacer(), 2)
            : '';
          return `🕒 ${timestamp} | ${level.toUpperCase()} | ${emoji} ${component} | ${message} ${metaStr}`;
        } catch (error) {
          return `🕒 ${timestamp} | ${level.toUpperCase()} | ${emoji} ${component} | ${message} [Error: Could not stringify metadata]`;
        }
      })
    ),
    transports: [
      new transports.Console({
        format: format.colorize({ all: true }),
      }),
    ],
  });
}

// Loggers predefinidos para servicios comunes
const loggers = {
  routes: createCustomLogger('Routes', '🛣️'),
  auth: createCustomLogger('Auth', '🔒'),
  images: createCustomLogger('Images', '🎨'),
  collections: createCustomLogger('📁 Collections', '📁'),
  interactions: createCustomLogger('👥 Interactions', '👥'),
  profile: createCustomLogger('👤 Profile', '👤'),
  system: createCustomLogger('⚙️ System', '⚙️'),
};

// Función para obtener un logger específico
export function getLogger(component) {
  return loggers[component] || createCustomLogger(component, '📝');
}

export const imageLogger = createCustomLogger('Image Controller', '🎨');
export const profileLogger = createCustomLogger('Profile Controller', '👤');
export const systemLogger = createCustomLogger('System', '⚙️');
