const { Images } = require('../models');
const stats = require('../helpers/stats');

const homeController = {
  async index(req, reply) {
    try {
      const images = await Images.find();
      const viewModel = { images };
      
      return reply.view('index', await stats.getSidebar(viewModel));
    } catch (error) {
      req.log.error(error);
      throw new Error('Error cargando la página principal');
    }
  }
};

module.exports = homeController;
