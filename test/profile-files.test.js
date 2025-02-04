import { jest, describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import profileRoutes from '../src/routes/profile.js';

describe('Profile Routes - File Uploads', () => {
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
    app = fastify({ logger: false });

    // Mock de Firebase
    const mockAdminDb = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            id: 'test-user-id',
            data: () => ({ ...mockUserData })
          }),
          update: jest.fn().mockImplementation(async (data) => {
            Object.assign(mockUserData, data);
            return { id: 'test-user-id' };
          })
        }),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: []
          })
        })
      })
    };

    // Mock directo de Cloudinary
    const mockCloudinary = {
      uploader: {
        upload_stream: jest.fn((options, callback) => {
          // Simular respuesta inmediata
          callback(null, {
            secure_url: options.folder === 'avatars' 
              ? 'https://example.com/test-photo.jpg' 
              : 'https://example.com/test-banner.jpg',
            public_id: options.folder === 'avatars' ? 'test-photo' : 'test-banner'
          });

          // Devolver un objeto que simula un stream
          return {
            write: () => {},
            end: () => {}
          };
        })
      }
    };

    app.decorate('firebase', { adminDb: mockAdminDb });
    app.decorate('cloudinary', mockCloudinary);

    await app.register(fastifyMultipart, {
      limits: {
        fieldSize: 5242880,
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

  it('should update profile with new photo', async () => {
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
      Buffer.from('Content-Disposition: form-data; name="biography"\r\n\r\n'),
      Buffer.from('Test biography\r\n'),
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
    expect(body.message).toContain('Perfil actualizado');
    expect(body.data.photoURL).toBe('https://example.com/test-photo.jpg');
  });

  it('should update profile with new banner', async () => {
    const bannerBuffer = Buffer.from('fake banner data');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="displayName"\r\n\r\n'),
      Buffer.from('Test User\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="username"\r\n\r\n'),
      Buffer.from('testuser\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="biography"\r\n\r\n'),
      Buffer.from('Test biography\r\n'),
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="banner"; filename="test.jpg"\r\n'),
      Buffer.from('Content-Type: image/jpeg\r\n\r\n'),
      bannerBuffer,
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
    expect(body.message).toContain('Perfil actualizado');
    expect(body.data.bannerURL).toBe('https://example.com/test-banner.jpg');
  });
}); 