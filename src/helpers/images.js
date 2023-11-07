const { Image } = require("../models");
const { SafeString } = require("handlebars");

module.exports = {
  async popular() {
    const images = await Image.find()
      .limit(9)
      .sort({ likes: -1 })

    for (let i = 0; i < images.length; i++) {
      // Convierte el contenido de la imagen a base64
      const base64 = Buffer.from(images[i].image.data).toString('base64');

      // Añade el tipo de contenido al inicio de la cadena base64
      images[i].imgSrc = new SafeString(`data:${images[i].image.contentType};base64,${base64}`);
    }

    return images;
  },
};