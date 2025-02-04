import { jest, describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import supertest from 'supertest';
import fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { Readable } from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

// Crear una función auxiliar para simular la subida de archivos
const createTestFile = async (filename, content = 'test content') => {
  const testDir = path.join(process.cwd(), 'test', 'temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const filePath = path.join(testDir, filename);
  await fs.promises.writeFile(filePath, content);
  return filePath;
};

describe('File Upload Functionality', () => {
  let app;
  let request;
  let testFilePath;

  beforeAll(async () => {
    // Crear un archivo de prueba
    testFilePath = await createTestFile('test-image.jpg');

    // Configurar la aplicación
    app = fastify({ logger: false });

    // Registrar multipart con una configuración específica para pruebas
    await app.register(fastifyMultipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 1000000,
        fields: 5,
        fileSize: 1000000,
        files: 2
      },
      attachFieldsToBody: true
    });

    // Mock simplificado de Firebase
    const mockFirebase = {
      adminDb: {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                uid: 'test-user',
                displayName: 'Test User'
              })
            }),
            update: jest.fn().mockResolvedValue(true)
          })
        })
      }
    };

    // Mock de Cloudinary que trabaja directamente con buffers
    const mockCloudinary = {
      uploader: {
        upload_stream: (options) => {
          const writable = new Readable({
            write(chunk, encoding, callback) {
              // Simular procesamiento del archivo
              setTimeout(() => {
                callback();
              }, 100);
            },
            final(callback) {
              // Simular finalización exitosa
              options.callback(null, {
                secure_url: `https://example.com/${options.folder}/test-image.jpg`,
                public_id: 'test-image'
              });
              callback();
            }
          });
          return writable;
        }
      }
    };

    // Ruta de prueba específica para subida de archivos
    app.post('/test-upload', async (request, reply) => {
      const file = await request.file();
      
      if (!file) {
        return reply.code(400).send({ error: 'No file provided' });
      }

      // Procesar el archivo usando un stream
      const chunks = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Simular subida a Cloudinary
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = mockCloudinary.uploader.upload_stream({
          folder: 'test',
          callback: (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        });

        uploadStream.end(buffer);
      });

      try {
        const result = await uploadPromise;
        return reply.send({
          success: true,
          url: result.secure_url
        });
      } catch (error) {
        return reply.code(500).send({ error: 'Upload failed' });
      }
    });

    await app.ready();
    request = supertest(app.server);
  });

  afterAll(async () => {
    // Limpiar archivos de prueba
    await fs.promises.unlink(testFilePath);
    await app.close();
  });

  it('should successfully upload a file', async () => {
    const response = await request
      .post('/test-upload')
      .attach('file', testFilePath)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.url).toMatch(/^https:\/\/example\.com\/test\//);
  });

  it('should handle missing file', async () => {
    const response = await request
      .post('/test-upload')
      .expect(400);

    expect(response.body.error).toBe('No file provided');
  });
}); 