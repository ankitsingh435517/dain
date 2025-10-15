// TODO: Add routes for journal
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
app.use(express.json());

// models
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const journalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Untitled",
    },
    content: {
      type: String,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("user", userSchema, "users");
const JournalModel = mongoose.model("journal", journalSchema, "journals");

// mongoose connection
try {
  const DB_URI = process.env.DB_URI;
  await mongoose.connect(DB_URI);
  console.log("Connected to DB");
} catch (e) {
  console.error("Couldn't connect to DB\nerror:", e);
}

const PORT = process.env.PORT || 5500;

// routes
app.get("/ping", (_, res) => res.json({ message: "pong" }));

const emailRegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const jwtExpiresIn = 1000 * 60 * 60;
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password || !emailRegExp.test(email.trim())) {
      throw new Error("Invalid email or password!");
    }
    const userExists = await UserModel.exists({ email });
    if (userExists) {
      throw new Error("User with that email already exists!");
    }
    const hashedPass = await bcryptjs.hash(password, 10);
    const user = await UserModel.create({
      email,
      password: hashedPass,
    });

    if (!user) throw new Error("Something went wrong while sign up!");

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: jwtExpiresIn,
      }
    );

    return res.status(201).json({ token });
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password || !emailRegExp.test(email.trim())) {
      throw new Error("Invalid email or password!");
    }
    const userInDb = await UserModel.findOne({ email }).lean();

    if (!userInDb) {
      throw new Error("User with that email does not exists!");
    }
    const isPassSame = await bcryptjs.compare(password, userInDb.password);
    if (!isPassSame) throw new Error("Email or password is invalid!");
    const token = jwt.sign(
      { userId: userInDb._id, email },
      process.env.JWT_SECRET,
      {
        expiresIn: jwtExpiresIn,
      }
    );

    return res.status(200).json({ token });
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});

app.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization.split("Bearer ")[1];
    if (!token) throw new Error("Invalid token!");
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const userInDb = await UserModel.findById(userId);
    if (!userInDb) {
      return res.status(404).send("No user found!");
    }
    return res.status(200).json({ email: userInDb.email });
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});

// TODO: add auth middleware and throw error if unauthorized
app.post("/journals", async (req, res) => {
  try {
    const { title, content, authorId } = req.body;
    const user = await UserModel.findById(authorId);
    if (!user) {
      throw new Error("Author not found!");
    }
    const journal = await JournalModel.create({
      title,
      content,
      author: user._id,
    });
    return res.status(201).json({ journal });
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});
app.get("/journals", (req, res) => {
  try {
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});
app.get("/journals/:id", (req, res) => {
  try {
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});
app.put("/journals", (req, res) => {
  try {
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
