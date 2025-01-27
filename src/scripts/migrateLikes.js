// scripts/migrateCloudinaryMetadata.js (versión corregida)
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

    let batch = adminDb.batch(); // Corregir: agregar 'let' para permitir reasignación

    for (const doc of snapshot.docs) {
      processed++;
      const data = doc.data();

      if (data.mainImageUrl && data.imageUrl) continue;

      let cloudinaryUrl = null;
      for (const value of Object.values(data)) {
        if (typeof value === 'string') {
          const match = value.match(CLOUDINARY_REGEX);
          if (match) {
            cloudinaryUrl = match[0];
            break;
          }
        }
      }

      if (cloudinaryUrl) {
        const updateData = {};

        if (!data.mainImageUrl) updateData.mainImageUrl = cloudinaryUrl;
        if (!data.imageUrl) updateData.imageUrl = cloudinaryUrl;

        if (Object.keys(updateData).length > 0) {
          batch.update(doc.ref, updateData);
          updated++;
        }
      }

      if (updated > 0 && updated % 500 === 0) {
        await batch.commit();
        batch = adminDb.batch(); // Reiniciar batch
        logger.info(`Procesados: ${processed} | Actualizados: ${updated}`);
      }
    }

    if (updated > 0) {
      await batch.commit();
    }

    // Corregir: usar logger.info en lugar de logger.success
    logger.info(`Migración completada. Total procesado: ${processed} | Actualizados: ${updated}`);
    process.exit(0);
  } catch (error) {
    logger.error('Error en la migración:', error);
    process.exit(1);
  }
};

migrateCloudinaryMetadata();
