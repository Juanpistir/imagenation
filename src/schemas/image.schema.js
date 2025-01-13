const { z } = require('zod');

// Patrón para IDs de Firebase (20 caracteres alfanuméricos)
const firebaseIdPattern = /^[A-Za-z0-9]{20}$/;

const imageSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional(),
  file: z.object({
    buffer: z.instanceof(Buffer),
    mimetype: z.string().regex(/^image\//),
    originalname: z.string()
  }),
  filename: z.string(),
  imageUrl: z.string().url().optional()
});

const imageQuerySchema = z.object({
  id: z.string().regex(firebaseIdPattern, {
    message: 'ID de imagen inválido. Debe ser un ID de Firebase válido.'
  })
});

const imageSearchSchema = z.object({
  query: z.string().min(1, "Término de búsqueda requerido")
});

module.exports = {
  imageSchema,
  imageQuerySchema,
  imageSearchSchema
};
