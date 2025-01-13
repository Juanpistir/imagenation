const { db } = require('../config/firebase.config');
const admin = require('firebase-admin');
const cloudinary = require('../config/cloudinary.config');

const Images = {
    async find(userId = null) {
        let query = db.collection('images').orderBy('timestamp', 'desc');
        if (userId) {
            query = query.where('userId', '==', userId);
        }
        const querySnapshot = await query.get();
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    async findOne(id) {
        const docRef = db.collection('images').doc(id);
        const doc = await docRef.get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },

    async create(data, fileBuffer, userId) {
        // Subir imagen a Cloudinary
        const cloudinaryResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { folder: 'imagenation', resource_type: 'auto' },
                (error, result) => error ? reject(error) : resolve(result)
            ).end(fileBuffer);
        });

        // Crear documento en Firestore
        const imageData = {
            ...data,
            userId,
            imageUrl: cloudinaryResult.secure_url,
            publicId: cloudinaryResult.public_id,
            timestamp: admin.firestore.Timestamp.now(),
            views: 0,
            likes: 0
        };

        const docRef = await db.collection('images').add(imageData);
        return { id: docRef.id, ...imageData };
    },

    async delete(id, userId) {
        const doc = await this.findOne(id);
        if (!doc || doc.userId !== userId) {
            throw new Error('No autorizado para eliminar esta imagen');
        }
        if (doc?.publicId) {
            await cloudinary.uploader.destroy(doc.publicId);
        }
        await db.collection('images').doc(id).delete();
        return true;
    },

    async updateLikes(id, likes) {
        const docRef = db.collection('images').doc(id);
        await docRef.update({ likes });
        return this.findOne(id);
    }
};

const Comments = {
    async find(imageId) {
        const querySnapshot = await db.collection('comments')
            .where('image_id', '==', imageId)
            .orderBy('timestamp', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    async create(data, userId) {
        const commentData = {
            ...data,
            userId,
            timestamp: admin.firestore.Timestamp.now()
        };
        const docRef = await db.collection('comments').add(commentData);
        return { id: docRef.id, ...commentData };
    }
};

module.exports = { Images, Comments };
