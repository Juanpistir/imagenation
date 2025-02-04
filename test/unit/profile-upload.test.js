import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { Readable, Writable } from 'stream';
import { Buffer } from 'buffer';

// Mock del módulo de Cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn()
    }
  }
}));

// Mock del módulo de Firebase Admin
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn()
      }))
    }))
  }))
}));

// Clase auxiliar para simular un stream de archivo
class MockFileStream extends Readable {
  constructor(data) {
    super();
    this.data = data;
  }

  _read() {
    this.push(this.data);
    this.push(null);
  }
}

// Clase auxiliar para simular un stream de subida
class MockUploadStream extends Writable {
  constructor(options, onFinish) {
    super();
    this.chunks = [];
    this.options = options;
    this.onFinish = onFinish;
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(chunk);
    callback();
  }

  _final(callback) {
    const buffer = Buffer.concat(this.chunks);
    this.onFinish(null, {
      secure_url: `https://example.com/${this.options.folder}/test-image.jpg`,
      public_id: 'test-image',
      bytes: buffer.length
    });
    callback();
  }
}

// Importar el controlador real
import { handleFileUpload } from '../../src/controllers/profile.js';

describe('Profile Upload Unit Tests', () => {
  let mockRequest;
  let mockReply;
  let cloudinary;
  let firebase;

  beforeEach(() => {
    // Resetear mocks
    jest.clearAllMocks();

    // Configurar mock de request
    mockRequest = {
      file: jest.fn(),
      user: { uid: 'test-user' }
    };

    // Configurar mock de reply
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    // Obtener referencias a los mocks
    cloudinary = require('cloudinary').v2;
    firebase = require('firebase-admin');
  });

  describe('File Upload Handler', () => {
    it('should process small image files correctly', async () => {
      // Preparar datos de prueba
      const imageData = Buffer.from('fake image data');
      const fileStream = new MockFileStream(imageData);
      
      mockRequest.file.mockResolvedValue({
        filename: 'test.jpg',
        mimetype: 'image/jpeg',
        file: fileStream
      });

      // Configurar mock de Cloudinary
      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        return new MockUploadStream(options, callback);
      });

      // Ejecutar la función
      await handleFileUpload(mockRequest, mockReply);

      // Verificaciones
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          url: expect.stringMatching(/^https:\/\/example\.com\/.*\/test-image\.jpg$/)
        })
      );
    });

    it('should handle missing files', async () => {
      mockRequest.file.mockResolvedValue(null);

      await handleFileUpload(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should handle invalid file types', async () => {
      const fileStream = new MockFileStream(Buffer.from('fake text data'));
      
      mockRequest.file.mockResolvedValue({
        filename: 'test.txt',
        mimetype: 'text/plain',
        file: fileStream
      });

      await handleFileUpload(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/invalid.*file.*type/i)
        })
      );
    });

    it('should handle upload errors', async () => {
      const imageData = Buffer.from('fake image data');
      const fileStream = new MockFileStream(imageData);
      
      mockRequest.file.mockResolvedValue({
        filename: 'test.jpg',
        mimetype: 'image/jpeg',
        file: fileStream
      });

      // Simular error en Cloudinary
      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        callback(new Error('Upload failed'));
        return new MockUploadStream(options, () => {});
      });

      await handleFileUpload(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/upload.*failed/i)
        })
      );
    });

    it('should handle large files efficiently', async () => {
      // Crear un archivo grande (5MB)
      const largeData = Buffer.alloc(5 * 1024 * 1024, 'x');
      const fileStream = new MockFileStream(largeData);
      
      mockRequest.file.mockResolvedValue({
        filename: 'large.jpg',
        mimetype: 'image/jpeg',
        file: fileStream
      });

      // Mock de Cloudinary que procesa el archivo en chunks
      cloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        return new MockUploadStream(options, callback);
      });

      await handleFileUpload(mockRequest, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          url: expect.any(String)
        })
      );
    });
  });
}); 