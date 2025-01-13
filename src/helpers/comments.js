const { db } = require('../config/firebase.config');

const Comments = {
    async newest() {
        try {
            const querySnapshot = await db.collection('comments')
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting comments:', error);
            return [];
        }
    }
};

module.exports = Comments;
