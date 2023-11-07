//Vamos a crear por separado las distintas partes de nuestro sidebar.

const { Estadisticas } = require("./stats");
const Images = require("./images");
const Comments = require("./comments");

module.exports = async (viewModel) => {
  //Desde aqui vamos a pasarle información a home.js y a index.js porque vamos a crear una sidebar y queremos que esten los mismos datos, en ambos.

  const results = await Promise.all([
    Estadisticas(), //Obtenemos las estadisticas (con cache)
    Images.popular(), //Obtenemos las imagenes más populares
    Comments.newest(), //Obtenemos los comentarios
  ]);
  viewModel.sidebar = {
    //Introducimos todo en un objeto
    stats: results[0],
    popular: results[1],
    comments: results[2],
  };

  return viewModel; // Es necesario poner el .sidebar para que permita mostrar los datos de lo contrario muestra [Object, object]
};

