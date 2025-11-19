// TODO: Add routes for journal
// TODO: Add cookie based auth flow
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL,
}));
app.use(express.json());

// models
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
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

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    deviceInfo: {
      deviceId: String,
      deviceName: String,
      deviceType: String,
      ipAddress: String,
      platform: String,
      userAgent: String,
      browser: String,
      browserVersion: String,
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
const RefreshTokenModel = mongoose.model("refreshToken", refreshTokenSchema, "refreshTokens");
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

const jwtAccessExpiresIn = 1000 * 60 * 60;
const jwtRefreshExpiresIn = 1000 * 60 * 60 * 24 * 7;
const signJwtAccess = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: jwtAccessExpiresIn,
    }
  );
};
const signJwtRefresh = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: jwtRefreshExpiresIn,
    }
  );
};
app.post("/signup", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email?.trim() || !username?.trim() || !password || !emailRegExp.test(email.trim())) {
      throw new Error("Invalid email, username or password!");
    }
    const userExists = await UserModel.exists({ email });
    if (userExists) {
      throw new Error("User with that email already exists!");
    }
    const hashedPass = await bcryptjs.hash(password, 10);
    const user = await UserModel.create({
      email,
      username,
      password: hashedPass,
    });

    if (!user) throw new Error("Something went wrong while sign up!");
    
    // create refresh and access token here
    const accessToken = signJwtAccess(user);
    const refreshToken = signJwtRefresh(user);

    // hash refresh token before saving in db
    const hashedRefreshToken = await bcryptjs.hash(refreshToken, 10);

    // delete existing refresh tokens for the user, highly unlikely during signup but just in case
    await RefreshTokenModel.deleteMany({ user: user._id });

    // persist refresh token in db
    await RefreshTokenModel.create({
      token: hashedRefreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + jwtRefreshExpiresIn),
    });

    // set refresh token in http only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: jwtRefreshExpiresIn, // 7 days
    });

    return res.status(201).json({ ok: true, accessToken });

  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail?.trim() || !password || usernameOrEmail.includes("@") && !emailRegExp.test(usernameOrEmail.trim())) {
      throw new Error("Invalid email, username or password!");
    }
    const userInDb = await UserModel.findOne({ $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }] }).lean();
    if (!userInDb) {
      throw new Error("User with that email or username does not exists!");
    }
    const isPassSame = await bcryptjs.compare(password, userInDb.password);
    if (!isPassSame) throw new Error("Email or password is invalid!");
    
    // create refresh and access token here
    const token = signJwtAccess(userInDb);
    const refreshToken = signJwtRefresh(userInDb);

    // hash refresh token before saving in db
    const hashedRefreshToken = await bcryptjs.hash(refreshToken, 10);

    // delete existing refresh tokens for the user
    await RefreshTokenModel.deleteMany({ user: userInDb._id });

    // persist refresh token in db
    await RefreshTokenModel.create({
      token: hashedRefreshToken,
      user: userInDb._id,
      expiresAt: new Date(Date.now() + jwtRefreshExpiresIn),
    });

    // set refresh token in http only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: jwtRefreshExpiresIn, // 7 days
    });

    return res.status(200).json({ ok: true, token });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
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

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization.split("Bearer ")[1];
    if (!token) throw new Error("Invalid token!");
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (_) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// journal routes
app.post("/journals", authMiddleware, async (req, res) => {
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
app.get("/journals", authMiddleware, async (req, res) => {
  try {
    const { authorId } = req.query;
    const journals = await JournalModel.find({ author: authorId }).lean();
    return res.status(200).json({ journals });
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});
app.get("/journals/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const journal = await JournalModel.findById(id).lean();
    if (!journal) {
      return res.status(404).json({ message: "Journal not found!" });
    }
    return res.status(200).json({ journal });
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});
app.put("/journals", authMiddleware, async (req, res) => {
  try {
    const { id, title, content } = req.body;
    const journal = JournalModel.findByIdAndUpdate(
      id,
      { title, content },
      { new: true }
    ).lean();
    if (!journal) {
      return res.status(404).json({ message: "Journal not found!" });
    }
    return res.status(200).json({ journal });
  } catch (e) {
    res.json({ message: e.message || "Something went wrong!" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
