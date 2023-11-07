const { Comment, Image } = require("../models");
const { SafeString } = require("handlebars");

module.exports = {
  async newest() {
    const comments = await Comment.find().limit(5).sort({ timestamp: -1 });

    for (const comment of comments) {
      const image = await Image.findOne({ _id: comment.image_id });
      // Convierte el contenido de la imagen a base64
      const base64 = Buffer.from(image.image.data).toString('base64');

      // Añade el tipo de contenido al inicio de la cadena base64
      image.imgSrc = new SafeString(`data:${image.image.contentType};base64,${base64}`);
      comment.image = image;
    }

    return comments;
  },
};
