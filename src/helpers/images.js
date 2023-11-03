const { Image } = require("../models"); //Importamos las imagenes de la base de datos.

module.exports = {
  //Función que luego llamaremos en sidebar para que sea pasada a los controladores.
  async popular() {
    const images = await Image.find() //Hacemos una consulta a la base de datos de imagenes
      .limit(9) //el limite de la consulta son 9, osea solo requerimos 9 imagenes
      .sort({ likes: -1 }); //las ordenamos por likes de más a menos.
    return images; //retornamos las imagenes consultadas
  },
};
