const { z } = require('zod');

// Esquema base de usuario
const userSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .min(5, 'El email debe tener al menos 5 caracteres')
    .max(255, 'El email no puede tener más de 255 caracteres'),
  
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede tener más de 100 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    ),
  
  username: z.string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(50, 'El nombre de usuario no puede tener más de 50 caracteres')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'El nombre de usuario solo puede contener letras, números, guiones y guiones bajos'
    )
});

// Esquema de registro
const registerSchema = userSchema.extend({
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Esquema de login
const loginSchema = z.object({
  email: userSchema.shape.email,
  password: userSchema.shape.password,
});

// Esquema de recuperación de contraseña
const forgotPasswordSchema = z.object({
  email: userSchema.shape.email,
});

// Esquema de reset de contraseña
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  password: userSchema.shape.password,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Esquema de actualización de perfil
const updateProfileSchema = z.object({
  username: userSchema.shape.username.optional(),
  email: userSchema.shape.email.optional(),
  currentPassword: userSchema.shape.password.optional(),
  newPassword: userSchema.shape.password.optional(),
  confirmNewPassword: z.string().optional()
}).refine((data) => {
  // Si se proporciona nueva contraseña, validar que coincida con la confirmación
  if (data.newPassword) {
    return data.newPassword === data.confirmNewPassword;
  }
  return true;
}, {
  message: "Las contraseñas no coinciden",
  path: ["confirmNewPassword"],
}).refine((data) => {
  // Si se proporciona nueva contraseña, requerir contraseña actual
  if (data.newPassword) {
    return !!data.currentPassword;
  }
  return true;
}, {
  message: "Se requiere la contraseña actual para cambiar la contraseña",
  path: ["currentPassword"],
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
};
