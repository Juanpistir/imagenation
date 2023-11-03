const NodeCache = require("node-cache");
const myCache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

const { Comment, Image } = require("../models");

const imageCounter = () => Image.countDocuments();
const commentsCounter = () => Comment.countDocuments();

const viewsCounter = async () => {
    const viewsCached = myCache.get("views");
    if (viewsCached) {
        return viewsCached;
    }

    const result = await Image.aggregate([
        {
            $group: {
                _id: "1",
                vistas: { $sum: "$views" }
            }
        }
    ]);

    const views = result[0].vistas;
    myCache.set("views", views); // Guardar en caché
    return views;
};

const likesCounter = async () => {
    const likesCached = myCache.get("likes");
    if (likesCached) {
        return likesCached;
    }

    const result = await Image.aggregate([
        {
            $group: {
                _id: "1",
                likesTotal: { $sum: "$likes" }
            }
        }
    ]);

    const likes = result[0].likesTotal;
    myCache.set("likes", likes); // Guardar en caché
    return likes;
};

const Estadisticas = async () => {
    const imagesCached = myCache.get("images");
    const commentsCached = myCache.get("comments");
    const images = imagesCached || (await imageCounter());
    const comments = commentsCached || (await commentsCounter());
    const views = await viewsCounter();
    const likes = await likesCounter();

    if (!imagesCached) myCache.set("images", images); // Guardar en caché
    if (!commentsCached) myCache.set("comments", comments); // Guardar en caché

    return { images, comments, views, likes };
};

const updateCache = () => {
    myCache.flushAll(); // Limpiar toda la caché
};

module.exports = {
    Estadisticas,
    updateCache
};
