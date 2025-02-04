import { jest, describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import supertest from 'supertest';
import fastify from 'fastify';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Función auxiliar para crear archivos de prueba
const createTestImage = async (name, size = 1024) => {
  const buffer = Buffer.alloc(size, 'a');
  const filePath = path.join(__dirname, '..', 'temp', name);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
};

describe('Profile Integration Tests', () => {
  let app;
  let request;
  let testPhotoPath;
  let testBannerPath;

  beforeAll(async () => {
    // Crear directorio temporal si no existe
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Crear archivos de prueba
    testPhotoPath = await createTestImage('test-photo.jpg');
    testBannerPath = await createTestImage('test-banner.jpg');

    // Importar la aplicación real
    const { createApp } = await import('../../src/app.js');
    app = await createApp({
      // Configuración específica para pruebas
      cloudinary: {
        cloud_name: 'test',
        api_key: 'test',
        api_secret: 'test'
      },
      firebase: {
        // Configuración de Firebase para pruebas
        projectId: 'test',
        clientEmail: 'test@test.com',
        privateKey: 'test'
      }
    });

    request = supertest(app.server);
  });

  afterAll(async () => {
    // Limpiar archivos de prueba
    await Promise.all([
      fs.promises.unlink(testPhotoPath),
      fs.promises.unlink(testBannerPath)
    ]);
    await app.close();
  });

  describe('Profile Updates', () => {
    it('should update profile with photo and basic info', async () => {
      const response = await request
        .put('/api/profile/test-user')
        .field('displayName', 'Test User')
        .field('username', 'testuser')
        .field('biography', 'Test bio')
        .attach('photo', testPhotoPath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        displayName: 'Test User',
        username: 'testuser',
        biography: 'Test bio'
      });
      expect(response.body.data.photoURL).toBeTruthy();
    });

    it('should update profile with banner', async () => {
      const response = await request
        .put('/api/profile/test-user')
        .field('displayName', 'Test User')
        .field('username', 'testuser')
        .field('biography', 'Test bio')
        .attach('banner', testBannerPath)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bannerURL).toBeTruthy();
    });

    it('should handle large files appropriately', async () => {
      const largePath = await createTestImage('large.jpg', 6 * 1024 * 1024); // 6MB
      
      try {
        const response = await request
          .put('/api/profile/test-user')
          .field('displayName', 'Test User')
          .field('username', 'testuser')
          .attach('photo', largePath)
          .expect(413); // Payload Too Large

        expect(response.body.error).toBeTruthy();
      } finally {
        await fs.promises.unlink(largePath);
      }
    });

    it('should handle invalid file types', async () => {
      const invalidPath = await createTestImage('test.txt');
      
      try {
        const response = await request
          .put('/api/profile/test-user')
          .field('displayName', 'Test User')
          .field('username', 'testuser')
          .attach('photo', invalidPath)
          .expect(400);

        expect(response.body.error).toBeTruthy();
      } finally {
        await fs.promises.unlink(invalidPath);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Simular error de red
      app.cloudinary = null;

      const response = await request
        .put('/api/profile/test-user')
        .field('displayName', 'Test User')
        .field('username', 'testuser')
        .attach('photo', testPhotoPath)
        .expect(500);

      expect(response.body.error).toBeTruthy();
    });

    it('should handle concurrent uploads', async () => {
      const promises = Array(3).fill(null).map(() => 
        request
          .put('/api/profile/test-user')
          .field('displayName', 'Test User')
          .field('username', 'testuser')
          .attach('photo', testPhotoPath)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
}); 