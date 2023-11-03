require('dotenv').config();
const path = require("path");
const exphbs = require("express-handlebars");
const morgan = require("morgan");
const multer = require("multer");
const express = require("express");
const routes = require("../routes/index");
const erroHandle = require("errorhandler")
const Handlebars = require('handlebars')
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access')

module.exports = (app) => {
  app.set("port", process.env.PORT || 3000);

  app.set("views", path.join(__dirname, "../views"));

  //Esto nos permite la configuración de handlebars en la app
  app.engine(
    ".hbs",
    exphbs.engine({
      defaultLayout: "main",
      partialsDir: path.join(app.get("views"), "partials"),
      layoutsDir: path.join(app.get("views"), "layouts"),
      extname: ".hbs",
      data: { toJSON: function(obj) { return obj.toJSON(); } },
      handlebars: allowInsecurePrototypeAccess(Handlebars),
      helpers: require("./helpers"),
    })
  );

  app.set("view engine", ".hbs");

  // Middlewares

  app.use(morgan("dev"));
  app.use(
    multer({ dest: path.join(__dirname, "../public/upload/temp") }).single(
      "image"
    )
  );
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Routes

  routes(app);

  app.use("/public", express.static(path.join(__dirname, "../public/")));

  if ("development" === app.get("env")){
    app.use(erroHandle)
  }

  return app;
};
