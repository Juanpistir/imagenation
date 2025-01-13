const NodeCache = require('node-cache');
const { db } = require('../config/firebase.config');

const statsCache = new NodeCache({ stdTTL: 300 });

const stats = {
    async getStats() {
        if (statsCache.has('stats')) {
            return statsCache.get('stats');
        }

        try {
            const [imagesSnap, commentsSnap] = await Promise.all([
                db.collection('images').get(),
                db.collection('comments').get()
            ]);

            const stats = {
                images: imagesSnap.size,
                comments: commentsSnap.size,
                views: imagesSnap.docs.reduce((acc, doc) => acc + (doc.data().views || 0), 0),
                likes: imagesSnap.docs.reduce((acc, doc) => acc + (doc.data().likes || 0), 0)
            };

            statsCache.set('stats', stats);
            return stats;
        } catch (error) {
            console.error('Error getting stats:', error);
            return {
                images: 0,
                comments: 0,
                views: 0,
                likes: 0
            };
        }
    },

    async getPopular() {
        const querySnapshot = await db.collection('images')
            .orderBy('views', 'desc')
            .limit(9)
            .get();
            
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    async getSidebar(viewModel) {
        const [stats, popular] = await Promise.all([
            this.getStats(),
            this.getPopular()
        ]);

        return {
            ...viewModel,
            sidebar: { 
                stats,
                popular 
            }
        };
    }
};

module.exports = stats;
