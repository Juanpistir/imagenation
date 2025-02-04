// Configuración global para Jest
import { jest } from '@jest/globals';

// Mock de Cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn().mockImplementation((options, callback) => {
        // Simular subida exitosa inmediatamente
        process.nextTick(() => {
          callback(null, {
            secure_url: options.folder === 'avatars' 
              ? 'https://example.com/test-photo.jpg'
              : 'https://example.com/test-banner.jpg'
          });
        });
        
        // Retornar un stream mock
        return {
          end: jest.fn(),
          on: jest.fn(),
          emit: jest.fn()
        };
      })
    }
  }
}));

// Mock mejorado para Firebase Admin
const mockFirestore = {
  collection: jest.fn((name) => ({
    doc: jest.fn((id) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        id: id,
        data: () => ({
          uid: id,
          displayName: 'Test User',
          username: 'testuser',
          biography: 'Test biography',
          photoURL: '',
          bannerURL: ''
        })
      }),
      update: jest.fn().mockResolvedValue(true)
    })),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'test-doc-id',
          data: () => ({
            title: 'Test Image',
            mainImageUrl: 'https://example.com/test.jpg',
            createdAt: new Date(),
            likesCount: 0,
            likes: []
          })
        }
      ]
    })
  }))
};

// Configuración global para pruebas
global.beforeEach(() => {
  // Limpiar todos los mocks antes de cada prueba
  jest.clearAllMocks();
});

// Aumentar timeout para pruebas que involucran subida de archivos
jest.setTimeout(120000);

// Exportar mocks para uso en archivos de prueba
export const mockAdminDb = mockFirestore;

// Silenciar logs durante las pruebas
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Configuración de variables de entorno para pruebas
process.env.NODE_ENV = 'test';

// Manejar errores no capturados durante las pruebas
process.on('unhandledRejection', (error) => {
  console.error('Error no manejado durante las pruebas:', error);
});
