ctrl = {};

const { Image } = require("../models");
const sidebar = require("../helpers/sidebar");
const { SafeString } = require("handlebars");

ctrl.index = async (req, res) => {
  const images = await Image.find().sort({ timestamp: -1 });
  
  let viewModel = { images: [] };

  for (let image of images) {
    // Convierte el contenido de la imagen a base64
    const base64 = Buffer.from(image.image.data).toString('base64');

    // Añade el tipo de contenido al inicio de la cadena base64
    const imgSrc = new SafeString(`data:${image.image.contentType};base64,${base64}`);

    viewModel.images.push({
      _id: image._id,
      imgSrc: imgSrc,
      ...image.toObject({ virtuals: true }) // Añade las propiedades virtuales y demás propiedades del objeto image
    });
  }

  viewModel = await sidebar(viewModel);

  res.render("index", viewModel);
};

module.exports = ctrl;
