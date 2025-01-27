// scripts/migrateCloudinaryMetadata.js
import 'dotenv/config';
import { adminDb } from '../config/firebase.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('Cloudinary Metadata Migration', '🖼️');

const CLOUDINARY_REGEX =
  /https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_\-]+\/(image|video)\/upload\/[^\s]+/i;

const migrateCloudinaryMetadata = async () => {
  try {
    const imagesRef = adminDb.collection('images');
    const snapshot = await imagesRef.get();
    let processed = 0;
    let updated = 0;

    const batch = adminDb.batch();

    for (const doc of snapshot.docs) {
      processed++;
      const data = doc.data();

      // Saltar documentos que ya tienen los metadatos
      if (data.mainImageUrl && data.imageUrl) {
        continue;
      }

      // Buscar URL de Cloudinary en cualquier campo
      let cloudinaryUrl = null;
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && CLOUDINARY_REGEX.test(value)) {
          cloudinaryUrl = value.match(CLOUDINARY_REGEX)[0];
          break;
        }
      }

      if (cloudinaryUrl) {
        const updateData = {};

        if (!data.mainImageUrl) {
          updateData.mainImageUrl = cloudinaryUrl;
        }

        if (!data.imageUrl) {
          updateData.imageUrl = cloudinaryUrl;
        }

        if (Object.keys(updateData).length > 0) {
          batch.update(doc.ref, updateData);
          updated++;
        }
      }

      // Commit cada 500 operaciones (límite de Firestore)
      if (updated > 0 && updated % 500 === 0) {
        await batch.commit();
        batch = adminDb.batch();
        logger.info(`Procesados: ${processed} | Actualizados: ${updated}`);
      }
    }

    // Commit final si quedan operaciones pendientes
    if (updated > 0) {
      await batch.commit();
    }

    logger.info(`Migración completada. Total procesado: ${processed} | Actualizados: ${updated}`);
    process.exit(0);
  } catch (error) {
    logger.error('Error en la migración:', error);
    process.exit(1);
  }
};

// Ejecutar migración
migrateCloudinaryMetadata();
