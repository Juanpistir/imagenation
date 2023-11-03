const helpers = {};

helpers.randonNumber = () => {
  const possible = "abcdefghijklmnoprstuvwyz0123456789";
  let randonNumber = 0;
  for (let i = 0; i < 6; i++) {
    randonNumber += possible.charAt(
      Math.floor(Math.random() * possible.length)
    );
  }
  return randonNumber;
};

module.exports = helpers;
