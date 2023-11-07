require("dotenv").config();
const path = require("path");
const exphbs = require("express-handlebars");
const morgan = require("morgan");
const express = require("express");
const router = express.Router();
const home = require("./controllers/home");
const image = require("./controllers/image");
const Handlebars = require("handlebars");
const mongoose = require("mongoose");
const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access');
errorHandle = require("errorhandler");
const multer = require("multer");

const app = express();
app.use(favicon(__dirname + '/public/favicon.ico'));

mongoose.set("strictQuery", false);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to the database");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
  }
};

connectDB();

app.set("port", process.env.PORT || 3000);
const PORT = app.get("port");

app.set("views", path.join(__dirname, "./views"));

app.engine(
  ".hbs",
  exphbs.engine({
    defaultLayout: "main",
    extname: ".hbs",
    partialsDir: path.join(app.get("views"), "partials"),
    layoutsDir: path.join(app.get("views"), "layouts"),
    handlebars: allowInsecurePrototypeAccess(Handlebars),
    helpers: require("./helpers/helpers.js"),
  })
);
app.set("view engine", ".hbs");

app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get("/", home.index);
router.get("/images/:image_id", image.index);
router.post("/images", upload.single("image"), image.create);
router.post("/images/:image_id/like", image.like);
router.post("/images/:image_id/comment", image.comment);
router.delete("/images/:image_id", image.remove);
router.get("/image/search", image.searchByTitle);

app.use("/public", express.static(path.join(__dirname, "./public")));
app.use(router);

if (app.get("env") === "development") {
  app.use(errorHandle);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});