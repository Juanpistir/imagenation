// Test para verificar la ruta /api/profile/check-username

import { jest, describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import profileRoutes from '../src/routes/profile.js';
import { mockAdminDb } from '../jest.setup.js';

describe('Profile Routes', () => {
  let app;
  let mockUserData;

  const defaultUserData = {
    uid: 'test-user-id',
    displayName: 'Test User',
    username: 'testuser',
    biography: 'Test biography',
    photoURL: '',
    bannerURL: ''
  };

  beforeAll(async () => {
    mockUserData = { ...defaultUserData };
    app = fastify({ logger: false }); // Desactivar logs en pruebas

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

    app.decorate('FBAuth', jest.fn().mockImplementation(async (request, reply) => {
      request.user = { uid: 'test-user-id' };
    }));

    await app.register(profileRoutes);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Basic Profile Operations', () => {
    it('should get profile successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/profile/test-user-id'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.profile).toBeDefined();
      expect(body.profile.displayName).toBe('Test User');
    });

    it('should update profile with basic info', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile/test-user-id',
        payload: {
          displayName: 'Updated User',
          username: 'updateduser',
          biography: 'Updated biography'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.displayName).toBe('Updated User');
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile/test-user-id',
        payload: {
          biography: 'Only biography'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Nombre y username son requeridos');
    });
  });

  describe('File Upload Operations', () => {
    it('should update profile with photo', async () => {
      const photoBuffer = Buffer.from('fake image data');
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
        photoBuffer,
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
    }, 30000);

    it('should handle large files appropriately', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="displayName"\r\n\r\n'),
        Buffer.from('Test User\r\n'),
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="username"\r\n\r\n'),
        Buffer.from('testuser\r\n'),
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from('Content-Disposition: form-data; name="photo"; filename="large.jpg"\r\n'),
        Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
        largeBuffer,
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

      expect(response.statusCode).toBe(413);
    });
  });

  describe('Authorization', () => {
    it('should prevent unauthorized profile updates', async () => {
      app.decorate('FBAuth', jest.fn().mockImplementation(async (request, reply) => {
        request.user = { uid: 'different-user-id' };
      }));

      const response = await app.inject({
        method: 'PUT',
        url: '/api/profile/test-user-id',
        payload: {
          displayName: 'Unauthorized Update',
          username: 'unauthorized'
        }
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('No autorizado para actualizar este perfil');
    });
  });
});

describe('Profile Routes - Username Verification', () => {
  let app;
  let mockUserData;

  const defaultUserData = {
    uid: 'test-user-id',
    username: 'testuser',
    displayName: 'Test User',
    biography: '',
    photoURL: '',
    bannerURL: ''
  };

  beforeAll(async () => {
    app = fastify({ logger: true });
    
    // Registrar multipart para manejar archivos
    await app.register(fastifyMultipart, {
      attachFieldsToBody: true,
      limits: {
        fieldSize: 5242880,
        files: 2,
        fileSize: 5242880
      }
    });

    // Mock de Firebase Admin
    const mockAdminDb = {
      collection: jest.fn((name) => ({
        doc: jest.fn((id) => ({
          get: jest.fn(async () => ({
            exists: true,
            id: id,
            data: () => ({ ...mockUserData })
          })),
          update: jest.fn(async (data) => {
            Object.assign(mockUserData, data);
            return { id };
          })
        })),
        where: jest.fn(() => ({
          get: jest.fn(async () => ({
            empty: true,
            docs: []
          }))
        }))
      }))
    };

    // Configurar el mock de Firebase en la app
    app.decorate('firebase', {
      adminDb: mockAdminDb
    });

    // Mock de autenticación
    app.decorate('FBAuth', jest.fn(async (request, reply) => {
      request.user = { uid: 'test-user-id' };
    }));

    // Registrar las rutas
    await app.register(profileRoutes);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return available=true for a new username', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/profile/check-username?username=newuser',
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.payload);
    expect(result).toEqual({ available: true });
  });

  it('should return 400 if username is not provided', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/profile/check-username',
    });

    expect(response.statusCode).toBe(400);
    const result = JSON.parse(response.payload);
    expect(result).toHaveProperty('error', 'Username es requerido');
  });

  it('should handle errors gracefully', async () => {
    // Modificar el mock para simular un error
    app.firebase.adminDb.collection = jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(async () => {
          throw new Error('Firebase error');
        }),
      })),
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/api/profile/check-username?username=error-user',
    });

    expect(response.statusCode).toBe(500);
    const result = JSON.parse(response.payload);
    expect(result).toHaveProperty('error', 'Error al verificar username');
  });
});

describe('Profile Routes - Basic Profile Editing', () => {
  let app;
  let mockUserData;

  const defaultUserData = {
    uid: 'test-user-id',
    displayName: 'Test User',
    username: 'testuser',
    biography: 'Test biography',
    photoURL: '',
    bannerURL: ''
  };

  beforeAll(async () => {
    mockUserData = { ...defaultUserData };
    app = fastify({ logger: true });

    // Mock de Firebase
    const mockAdminDb = {
      collection: jest.fn((name) => ({
        doc: jest.fn((id) => ({
          get: jest.fn(async () => ({
            exists: true,
            id: id,
            data: () => ({ ...mockUserData })
          })),
          update: jest.fn(async (data) => {
            Object.assign(mockUserData, data);
            return { id };
          })
        })),
        where: jest.fn((field, op, value) => ({
          get: jest.fn(async () => ({
            empty: true,
            docs: []
          }))
        }))
      }))
    };

    app.decorate('firebase', { adminDb: mockAdminDb });

    await app.register(fastifyMultipart, {
      limits: {
        fieldSize: 5242880,
        files: 2,
        fileSize: 5242880
      }
    });

    app.decorate('FBAuth', jest.fn(async (request, reply) => {
      request.user = { uid: 'test-user-id' };
    }));

    await app.register(profileRoutes);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should update profile with new biography', async () => {
    mockUserData = { ...defaultUserData };
    
    const response = await app.inject({
      method: 'PUT',
      url: '/api/profile/test-user-id',
      payload: {
        biography: 'New test biography',
        displayName: 'Test User',
        username: 'testuser'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Perfil actualizado');
    expect(body.data.biography).toBe('New test biography');
  });

  it('should handle validation errors', async () => {
    mockUserData = { ...defaultUserData };
    
    const response = await app.inject({
      method: 'PUT',
      url: '/api/profile/test-user-id',
      payload: {
        displayName: '',
        username: 'testuser',
        biography: 'Test biography'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Nombre y username son requeridos');
  });
});
        
