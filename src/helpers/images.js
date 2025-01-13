const cloudinary = require('../config/cloudinary.config');
const { db } = require('../config/firebase.config');
const admin = require('firebase-admin');

const Images = {
    async uploadImage(fileBuffer, options = {}) {
        try {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder: 'imagenation',
                        resource_type: 'auto',
                        ...options
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                ).end(fileBuffer);
            });
            
            const imageData = {
                imageUrl: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                width: result.width,
                height: result.height,
                timestamp: admin.firestore.Timestamp.now(),
                views: 0,
                likes: 0,
                title: options.filename || 'Sin título',
                description: options.description || '',
                ...options
            };

            const docRef = await db.collection('images').add(imageData);
            return { id: docRef.id, ...imageData };
        } catch (error) {
            throw error;
        }
    },

    async getImage(id) {
        try {
            const docRef = db.collection('images').doc(id);
            const docSnap = await docRef.get();
            
            if (!docSnap.exists) {
                return null;
            }

            await docRef.update({
                views: (docSnap.data().views || 0) + 1
            });

            return { 
                id: docSnap.id,
                ...docSnap.data() 
            };
        } catch (error) {
            console.error('Error getting image:', error);
            throw error;
        }
    },

    async getOptimizedUrl(publicId, options = {}) {
        const defaultOptions = {
            fetch_format: 'auto',
            quality: 'auto',
            secure: true
        };

        return cloudinary.url(publicId, {
            ...defaultOptions,
            ...options
        });
    },

    async deleteImage(publicId) {
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Error deleting image:', error);
            throw error;
        }
    },

    async popular() {
        try {
            const querySnapshot = await db.collection('images')
                .orderBy('views', 'desc')
                .limit(9)
                .get();
                
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting popular images:', error);
            return [];
        }
    }
};

module.exports = Images;