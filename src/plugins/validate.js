const fp = require('fastify-plugin');
const { ZodError } = require('zod');

async function validatePlugin(fastify, options) {
  fastify.setValidatorCompiler(({ schema }) => {
    return data => {
      try {
        return schema.parse(data);
      } catch (error) {
        if (error instanceof ZodError) {
          throw { 
            statusCode: 400, 
            errors: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }))
          };
        }
        throw error;
      }
    };
  });
}

module.exports = fp(validatePlugin);
