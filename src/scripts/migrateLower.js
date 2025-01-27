// scripts/migrateLower.js
import 'dotenv/config';
import { adminDb } from '../config/firebase.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('Search Fields Migration', '');

const migrateSearchFields = async () => {
  try {
    const imagesRef = adminDb.collection('images');
    const snapshot = await imagesRef.get();
    let processed = 0;
    let updated = 0;
    let batch = adminDb.batch();
    const batchSize = 500;

    logger.info(`Iniciando migración de ${snapshot.size} documentos...`);

    for (const doc of snapshot.docs) {
      processed++;
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;

      // Verificar y agregar campos lower case si no existen
      if (!data.title_lower && data.title) {
        updates.title_lower = data.title.toLowerCase();
        needsUpdate = true;
      }

      if (!data.description_lower && data.description) {
        updates.description_lower = data.description.toLowerCase();
        needsUpdate = true;
      }

      // Verificar y agregar campo isPublic si no existe
      if (data.isPublic === undefined) {
        updates.isPublic = true; // Por defecto todas las imágenes son públicas
        needsUpdate = true;
      }

      // Verificar y agregar array de tags si no existe
      if (!data.tags) {
        updates.tags = [];
        needsUpdate = true;
      }

      if (needsUpdate) {
        batch.update(doc.ref, updates);
        updated++;

        // Commit batch cuando alcance el tamaño límite
        if (updated % batchSize === 0) {
          await batch.commit();
          batch = adminDb.batch();
          logger.info(`Procesados ${processed} documentos, actualizados ${updated}`);
        }
      }

      // Log de progreso cada 100 documentos
      if (processed % 100 === 0) {
        logger.info(`Procesados ${processed}/${snapshot.size} documentos...`);
      }
    }

    // Commit final si quedan actualizaciones pendientes
    if (updated % batchSize !== 0) {
      await batch.commit();
    }

    logger.info(`Migración completada. Total procesados: ${processed}, actualizados: ${updated}`);
  } catch (error) {
    logger.error('Error durante la migración:', error);
    process.exit(1);
  }
};

// Ejecutar migración
migrateSearchFields();
