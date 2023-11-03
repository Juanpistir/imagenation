const moment = require("moment");

const helpers = {};

helpers.back = (timestamp) => {
  return moment(timestamp).startOf("minute").fromNow();
};

module.exports = helpers;
