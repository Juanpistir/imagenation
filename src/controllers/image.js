const path = require("path");
const { randonNumber } = require("../helpers/libs");
const md5 = require("md5"); //
const { updateCache } = require("../helpers/stats");
const { Image, Comment } = require("../models");
const sidebar = require("../helpers/sidebar");
const { SafeString } = require("handlebars");

const ctrl = {};

ctrl.index = async (req, res) => {
  let viewModel = { images: {}, comments: {} };

  const image = await Image.findOne({
    filename: { $regex: req.params.image_id },
  });

  if (image) {
    // Convierte el contenido de la imagen a base64
    const base64 = Buffer.from(image.image.data).toString('base64');

    // Añade el tipo de contenido al inicio de la cadena base64
    const imgSrc = new SafeString(`data:${image.image.contentType};base64,${base64}`);

    const comments = await Comment.find({ image_id: image._id });
    image.views = image.views + 1;
    viewModel.comments = comments;
    await image.save();
    updateCache();
    viewModel.imageSrc = imgSrc; // Cambia esto para usar imgSrc en lugar de image
    viewModel.image = image; // Añade esto para mantener una referencia al objeto image original// Cambia esto para usar imgSrc en lugar de image
    viewModel = await sidebar(viewModel);
    res.render("image", viewModel);
  } else {
    res.redirect("/");
  }
};




ctrl.create = async (req, res) => {
  const saveImage = async () => {
    const imgUrl = randonNumber(); // Genera el nombre de archivo aleatorio

    const existingImages = await Image.find({ filename: imgUrl });
    if (existingImages.length > 0) {
      // Si el nombre del archivo ya existe, intenta generar uno nuevo
      return saveImage();
    } else {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (
        ext !== ".png" &&
        ext !== ".jpg" &&
        ext !== ".jpeg" &&
        ext !== ".gif"
      ) {
        const errorMessage = "Solo imágenes permitidas";
        return res.send(
          `<script>alert('${errorMessage}'); window.history.back();</script>`
        );
      }

      try {
        const newImage = new Image({
          title: req.body.title,
          image: { data: req.file.buffer, contentType: req.file.mimetype }, // { data: Buffer, contentType: String
          filename: imgUrl + ext,
          description: req.body.description,
        });
        await newImage.save();
        updateCache();
        res.redirect("/images/" + imgUrl);
      } catch (error) {
        console.error("Error al subir la imagen:", error);
        res.status(500).send("Error al subir la imagen");
      }
    }
  };

  // Espera a que saveImage se complete antes de continuar
  await saveImage();
};
  // Controlador de likes

ctrl.like = async (req, res) => {
  // lo siguiente sirve para que busque todas las imagenes que cumplen con id que se le esta pasando por la ruta

  const image = await Image.findOne({
    filename: { $regex: req.params.image_id },
  });

  //Si se encuente una imagen haz lo siguiente:

  if (image) {
    image.likes = image.likes + 1; // Aumenta la cantidad de likes en 1,
    await image.save(); // Guardalo en la base de datos
    updateCache();
    res.json({ likes: image.likes }); // Responde la peticion mostrando la cantidad total de likes al cliente
  } else {
    res.status(500).json({ error: "Internal Error" }); //En caso de no poder encontrar una imagen mostrar un error.
  }
};

// Controlador que usamos para crear nuevos comentarios

ctrl.comment = async (req, res) => {
  const image = await Image.findOne({
    filename: { $regex: req.params.image_id },
  });
  if (image) {
    const newComment = new Comment(req.body);
    newComment.gravatar = md5(newComment.email);
    newComment.image_id = image._id;
    await newComment.save();
    updateCache();
    res.redirect("/images/" + image.uniqueId);
  } else {
    res.redirect("/");
  }
};

// Controlador que usamos para eliminar las imagenes,

ctrl.remove = async (req, res) => {
  try {
    const image = await Image.findOne({
      filename: { $regex: req.params.image_id },
    });

    if (image) {
      // Elimina los comentarios asociados a la imagen
      await Comment.deleteMany({ image_id: image._id });

      // Elimina la imagen de la base de datos
      await Image.deleteOne({ _id: image._id });
      updateCache();
      res.json("La imagen fue eliminada exitosamente");
    } else {
      res.status(404).json({ error: "La imagen no fue encontrada" });
    }
  } catch (error) {
    console.error("Error al eliminar la imagen:", error);
    res.status(500).json({ error: "Error al eliminar la imagen" });
  }
};

ctrl.searchByTitle = async (req, res) => {
  const searchTerm = req.query.title;

  try {
    const images = await Image.find({
      title: { $regex: searchTerm, $options: "i" },
    });

    const results = images.map(image => {
      // Convierte el contenido de la imagen a base64
      const base64 = Buffer.from(image.image.data).toString('base64');

      // Crea un nuevo objeto con las propiedades que necesitamos
      return {
        _id: image._id,
        title: image.title,
        description: image.description,
        filename: image.filename,
        views: image.views,
        likes: image.likes,
        timestamp: image.timestamp,
        imgSrc: `data:${image.image.contentType};base64,${base64}`,
      };
    });

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: "Error al buscar imágenes por título" });
  }
};

module.exports = ctrl;
