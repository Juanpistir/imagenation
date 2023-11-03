const path = require("path");
const { randonNumber } = require("../helpers/libs"); // Modulo que creamos para generar numero aleatorio.
const fs = require("fs-extra"); // Modulo Filesystem más avanzado que permite eliminar, renombrar archivos y más.
const md5 = require("md5"); // Modulo que permite generar avatars aleatorias
const { updateCache } = require("../helpers/stats");
const { Image, Comment } = require("../models"); //Importamos el modelo Image y el modelo Comment
const sidebar = require("../helpers/sidebar");

const MAX_FILE_SIZE = 1 * 1024 * 1024;

const ctrl = {};

const checkFileSize = (req, res, next) => {
  if (req.file && req.file.size > MAX_FILE_SIZE) {
    fs.unlinkSync(req.file.path); // Elimina el archivo si excede el tamaño permitido
    const errorMessage = "El archivo excede el tamaño permitido";
    return res.send(
      `<script>alert('${errorMessage}'); window.history.back();</script>`
    );
  }
  next();
};

ctrl.index = async (req, res) => {
  let viewModel = { images: {}, comments: {} };

  const image = await Image.findOne({
    filename: { $regex: req.params.image_id },
  });

  if (image) {
    const comments = await Comment.find({ image_id: image._id });
    image.views = image.views + 1;
    viewModel.comments = comments;
    await image.save();
    updateCache();
    viewModel.image = image;
    viewModel = await sidebar(viewModel);
    res.render("image", viewModel);
  } else {
    res.redirect("/");
  }
};

ctrl.create = async (req, res) => {
  checkFileSize(req, res, async () => {
    const saveImage = async () => {
      const imgUrl = randonNumber(); // Genera el nombre de archivo aleatorio

      const existingImages = await Image.find({ filename: imgUrl });
      if (existingImages.length > 0) {
        saveImage(); // Si el nombre del archivo ya existe, intenta generar uno nuevo
      } else {
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (
          ext !== ".png" &&
          ext !== ".jpg" &&
          ext !== ".jpeg" &&
          ext !== ".gif"
        ) {
          fs.unlinkSync(req.file.path); // Elimina el archivo si no es un tipo permitido
          const errorMessage = "Solo imágenes permitidas";
          return res.send(
            `<script>alert('${errorMessage}'); window.history.back();</script>`
          );
        }

        const targetPath = path.resolve(`src/public/upload/${imgUrl}${ext}`);

        try {
          // Mueve el archivo a la ubicación deseada
          await fs.rename(req.file.path, targetPath);

          // Crea una nueva imagen en la base de datos
          const newImage = new Image({
            title: req.body.title,
            filename: imgUrl + ext,
            description: req.body.description,
          });
          const imageSaved = await newImage.save();
          updateCache();
          res.redirect("/images/" + imgUrl);
        } catch (error) {
          console.error("Error al subir la imagen:", error);
          res.status(500).send("Error al subir la imagen");
        }
      }
    };

    await saveImage();
  });
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
      await fs.unlink(path.resolve("./src/public/upload/" + image.filename)); // Elimina el archivo de la imagen

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
    //console.log(images);
    res.json({ results: images });
   //res.render('main.hbs', { results: images });
  } catch (error) {
    res.status(500).json({ error: "Error al buscar imágenes por título" });
  }
};

module.exports = ctrl;
