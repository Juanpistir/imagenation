const express = require("express");
const router = express.Router();

const home = require("../controllers/home");
const image = require("../controllers/image");

module.exports = (app) => {
  router.get("/", home.index);
  router.get("/images/:image_id", image.index);
  router.post("/images", image.create);
  router.post("/images/:image_id/like", image.like);   // Ruta para que el controlador maneje los likes.
  router.post("/images/:image_id/comment", image.comment);   // Ruta para que el controlador maneje los comentarios.
  router.delete("/images/:image_id", image.remove);   // Ruta para que el controlador image.remove maneje las eliminaciones de las imagenes. 
  router.get("/image/search", image.searchByTitle);

  app.use(router)
};
