import { jest, describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import profileRoutes from '../../src/routes/profile.js';
import { mockAdminDb } from '../../jest.setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Profile File Upload Integration Tests', () => {
  let app;
  let testPhotoPath;
  let testBannerPath;
  const tempDir = path.join(__dirname, '..', 'temp');

  beforeAll(async () => {
    // Crear directorio temporal si no existe
    await fs.mkdir(tempDir, { recursive: true });

    // Crear archivos de prueba
    testPhotoPath = path.join(tempDir, 'test-photo.jpg');
    testBannerPath = path.join(tempDir, 'test-banner.jpg');

    // Crear archivos de prueba con contenido mínimo
    await fs.writeFile(testPhotoPath, Buffer.from('fake photo data'));
    await fs.writeFile(testBannerPath, Buffer.from('fake banner data'));

    // Configurar la aplicación
    app = fastify({ logger: false });

    // Mock de renderWithContext
    app.decorate('renderWithContext', jest.fn().mockImplementation((template, data) => {
      return JSON.stringify({ template, data });
    }));

    // Configurar mocks y decoradores
    app.decorate('firebase', { adminDb: mockAdminDb });

    await app.register(fastifyMultipart, {
      limits: {
        fieldSize: 5242880, // 5MB
        files: 2,
        fileSize: 5242880
      }
    });

    // Decorar antes de registrar las rutas
    app.decorate('FBAuth', jest.fn().mockImplementation(async (request, reply) => {
      request.user = { uid: 'test-user-id' };
    }));

    await app.register(profileRoutes);
  });

  afterAll(async () => {
    // Limpiar archivos temporales
    try {
      await fs.unlink(testPhotoPath);
      await fs.unlink(testBannerPath);
      await fs.rmdir(tempDir);
    } catch (error) {
      console.error('Error limpiando archivos temporales:', error);
    }
    
    if (app) {
      await app.close();
    }
  });

  it('should handle photo upload successfully', async () => {
    const photoStream = await fs.readFile(testPhotoPath);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="displayName"\r\n\r\n'),
      Buffer.from('Test User\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="username"\r\n\r\n'),
      Buffer.from('testuser\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="photo"; filename="test.jpg"\r\n'),
      Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
      photoStream,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/profile/test-user-id',
      payload,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': payload.length.toString()
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.photoURL).toBe('https://example.com/test-photo.jpg');
  }, 180000); // Aumentar timeout a 3 minutos

  it('should handle banner upload successfully', async () => {
    const bannerStream = await fs.readFile(testBannerPath);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="displayName"\r\n\r\n'),
      Buffer.from('Test User\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="username"\r\n\r\n'),
      Buffer.from('testuser\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="banner"; filename="test.jpg"\r\n'),
      Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
      bannerStream,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/profile/test-user-id',
      payload,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': payload.length.toString()
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.bannerURL).toBe('https://example.com/test-banner.jpg');
  }, 180000);

  it('should handle invalid file types', async () => {
    const invalidFilePath = path.join(tempDir, 'invalid.txt');
    await fs.writeFile(invalidFilePath, 'invalid file content');

    try {
      const fileStream = await fs.readFile(invalidFilePath);
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="displayName"\r\n\r\n'),
        Buffer.from('Test User\r\n'),
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="username"\r\n\r\n'),
        Buffer.from('testuser\r\n'),
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="photo"; filename="invalid.txt"\r\n'),
        Buffer.from('Content-Type: text/plain\r\n\r\n'),
        fileStream,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile/test-user-id',
        payload,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          'content-length': payload.length.toString()
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBeTruthy();
    } finally {
      await fs.unlink(invalidFilePath);
    }
  }, 180000);

  it('should handle concurrent file uploads', async () => {
    const photoStream = await fs.readFile(testPhotoPath);
    const bannerStream = await fs.readFile(testBannerPath);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="displayName"\r\n\r\n'),
      Buffer.from('Test User\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="username"\r\n\r\n'),
      Buffer.from('testuser\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="photo"; filename="test.jpg"\r\n'),
      Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
      photoStream,
      Buffer.from(`\r\n--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="banner"; filename="test.jpg"\r\n'),
      Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
      bannerStream,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const response = await app.inject({
      method: 'PUT',
      url: '/api/profile/test-user-id',
      payload,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': payload.length.toString()
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.photoURL).toBe('https://example.com/test-photo.jpg');
    expect(body.data.bannerURL).toBe('https://example.com/test-banner.jpg');
  }, 180000);
}); 