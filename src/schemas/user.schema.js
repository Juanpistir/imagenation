const { z } = require('zod');

// Esquema de estadísticas
const statsSchema = z.object({
  uploads: z.number().int().min(0).default(0),
  likes: z.number().int().min(0).default(0),
  comments: z.number().int().min(0).default(0),
  views: z.number().int().min(0).default(0)
});

// Esquema de preferencias
const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  language: z.enum(['es', 'en']).default('es')
}).partial();

// Esquema base de usuario
const userSchema = z.object({
  uid: z.string().min(1, 'UID es requerido'),
  email: z.string().email('Email inválido'),
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(50, 'El nombre de usuario no puede tener más de 50 caracteres')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'El nombre de usuario solo puede contener letras, números, guiones y guiones bajos'
    ),
  photoURL: z.string().url('URL de foto inválida').optional().nullable(),
  roles: z.array(z.enum(['user', 'admin', 'moderator'])).default(['user']),
  stats: statsSchema.default({}),
  preferences: preferencesSchema.default({}),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  lastLogin: z.date().default(() => new Date())
});

// Esquema para crear usuario
const createUserSchema = userSchema.omit({ 
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
  stats: true
}).extend({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede tener más de 100 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    )
});

// Esquema para actualizar usuario
const updateUserSchema = userSchema
  .partial()
  .omit({ 
    uid: true,
    email: true,
    createdAt: true
  });

// Esquema para respuesta de usuario
const userResponseSchema = userSchema.omit({
  password: true
}).extend({
  id: z.string()
});

// Esquema para lista de usuarios
const userListSchema = z.array(userResponseSchema);

// Esquema para búsqueda de usuarios
const userSearchSchema = z.object({
  query: z.string().min(1).max(100),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['username', 'createdAt', 'lastLogin']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

module.exports = {
  userSchema,
  createUserSchema,
  updateUserSchema,
  userResponseSchema,
  userListSchema,
  userSearchSchema,
  statsSchema,
  preferencesSchema
};
