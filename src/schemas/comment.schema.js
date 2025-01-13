const { z } = require('zod');

const commentSchema = z.object({
  image_id: z.string(),
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "Nombre requerido"),
  comment: z.string().min(1, "Comentario requerido").max(500, "Comentario demasiado largo"),
  timestamp: z.date().default(() => new Date())
});

module.exports = {
  commentSchema
};
