//Este código permite conectar el servidor con la base de datos.

require('dotenv').config();
const express = require("express");
const config = require("./server/config.js");
const mongoose = require("mongoose");

mongoose.set("strictQuery", false);

const connectDB = () => {
    return mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
    });
  };
  
  const app = config(express());
  const PORT = app.get("port");
  
  connectDB()
    .then(() => {
      console.log("DB está conectada");
      app.listen(PORT, () => console.log("Servidor en puerto ", PORT));
    })
    .catch((err) => console.error(err));


    