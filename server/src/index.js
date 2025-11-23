import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  })
);
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

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Untitled",
    },
    value: {
      type: String,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("user", userSchema, "users");
const RefreshTokenModel = mongoose.model(
  "refreshToken",
  refreshTokenSchema,
  "refreshTokens"
);
const NoteModel = mongoose.model("note", noteSchema, "notes");

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
    const deviceInfo = JSON.parse(req.headers["x-device-info"]);
    if (
      !email?.trim() ||
      !username?.trim() ||
      !password ||
      !emailRegExp.test(email.trim())
    ) {
      throw new Error("Invalid email, username or password!");
    }
    const userExists = await UserModel.exists({ email });
    if (userExists) {
      throw new Error("User with that email already exists!");
    }

    const usernameExists = await UserModel.exists({ username });
    if (usernameExists) {
      throw new Error("User with that username already exists!");
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
      deviceInfo: deviceInfo,
    });

    // set refresh token in http only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: jwtRefreshExpiresIn, // 7 days
    });

    return res.status(201).json({ ok: true, accessToken, user });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (
      !usernameOrEmail?.trim() ||
      !password ||
      (usernameOrEmail.includes("@") &&
        !emailRegExp.test(usernameOrEmail.trim()))
    ) {
      throw new Error("Invalid email, username or password!");
    }
    const userInDb = await UserModel.findOne({
      $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    }).lean();
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

    const deviceInfo = JSON.parse(req.headers["x-device-info"]);
    // delete existing refresh tokens for the user
    await RefreshTokenModel.deleteMany({
      user: userInDb._id,
      "deviceInfo.deviceId": deviceInfo.deviceId,
    });

    // persist refresh token in db
    await RefreshTokenModel.create({
      token: hashedRefreshToken,
      user: userInDb._id,
      expiresAt: new Date(Date.now() + jwtRefreshExpiresIn),
      deviceInfo: deviceInfo,
    });

    // set refresh token in http only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: jwtRefreshExpiresIn, // 7 days
    });

    return res
      .status(201)
      .json({ ok: true, accessToken: token, user: userInDb });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});

app.post("/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const deviceInfo = JSON.parse(req.headers["x-device-info"]);
    if (!refreshToken) throw new Error("Invalid refresh token!");

    // verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (_) {
      throw new Error("Invalid refresh token!");
    }

    // verify user exists
    const userInDb = await UserModel.findById(payload.userId);
    if (!userInDb) throw new Error("User not found!");

    // verify refresh token exists in db
    const tokenInDb = await RefreshTokenModel.findOne({
      user: payload.userId,
      "deviceInfo.deviceId": deviceInfo.deviceId,
    });
    if (!tokenInDb) throw new Error("Invalid refresh token!");

    // compare hashes
    const isSame = bcryptjs.compareSync(refreshToken, tokenInDb.token);
    if (!isSame) throw new Error("Invalid refresh token!");

    // delete refresh token from db
    const deleted = await RefreshTokenModel.deleteMany({
      token: tokenInDb.token,
      "deviceInfo.deviceId": deviceInfo.deviceId,
    });
    if (!deleted) throw new Error("Something went wrong while logging out!");

    res.clearCookie("refreshToken");

    return res
      .status(200)
      .json({ ok: true, message: "Logged out successfully!" });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});

app.post("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new Error("Invalid refresh token!");
    const deviceInfo = JSON.parse(req.headers["x-device-info"]);

    // verify refresh token
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (_) {
      // logout user from this device
      await RefreshTokenModel.deleteMany({
        token: hashedRefreshToken,
        "deviceInfo.deviceId": deviceInfo.deviceId,
      });
      throw new Error("Invalid refresh token!");
    }

    // check if refresh token exists in db
    const token = await RefreshTokenModel.findOne({
      user: payload.userId,
      "deviceInfo.deviceId": deviceInfo.deviceId,
    });
    if (!token) throw new Error("Invalid refresh token!");

    const user = await UserModel.findById(token.user);
    if (!user) {
      await RefreshTokenModel.deleteMany({ user: token.user });
      throw new Error("User not found!");
    }

    // compare hashes
    const isSame = bcryptjs.compareSync(refreshToken, token.token);

    if (!isSame) throw new Error("Invalid refresh token!");

    // check if refresh token is expired
    if (token.expiresAt < new Date()) {
      // delete refresh token from db
      await RefreshTokenModel.deleteMany({
        token: hashedRefreshToken,
        "deviceInfo.deviceId": deviceInfo.deviceId,
      });
      throw new Error("Refresh token expired! Please login again.");
    }

    // create new access token
    const accessToken = signJwtAccess({
      _id: payload.userId,
      email: payload.email,
    });

    // Rotate refresh token
    const newRefreshToken = signJwtRefresh(user);
    const hashedNewRefreshToken = await bcryptjs.hash(newRefreshToken, 10);

    // delete existing refresh tokens for the user
    await RefreshTokenModel.deleteMany({
      user: user._id,
      "deviceInfo.deviceId": deviceInfo.deviceId,
    });

    // persist refresh token in db
    await RefreshTokenModel.create({
      token: hashedNewRefreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + jwtRefreshExpiresIn), // 7 days
      deviceInfo: deviceInfo,
    });

    // set refresh token in http only cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: jwtRefreshExpiresIn, // 7 days
    });

    return res.status(200).json({ ok: true, accessToken, user });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});

app.get("/me", async (req, res) => {
  try {
    const token = req.headers?.authorization?.split("Bearer ")?.[1];
    if (!token) throw new Error("Invalid token!");

    const { userId } = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

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
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (_) {
    res.status(401).json({ message: "Unauthorized" });
  }
};

// notes routes
app.post("/notes", authMiddleware, async (req, res) => {
  try {
    const { title, value } = req.body;
    const { userId } = req.user;
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("User not found!");
    }
    const note = await NoteModel.create({
      title,
      value,
      user: user._id,
    });
    return res.status(201).json({ ok: true, note });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});
app.get("/notes", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const notes = await NoteModel.find({ user: userId }).lean();
    return res.status(200).json({ ok: true, notes });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});
app.get("/notes/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("User not found!");
    }
    const note = await NoteModel.findOne({ _id: id, user: userId }).lean();
    if (!note) {
      return res.status(404).json({ ok: false, message: "Note not found!" });
    }
    return res.status(200).json({ ok: true, note });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});
app.put("/notes/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, value } = req.body;
    const { userId } = req.user;
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("User not found!");
    }
    const note = await NoteModel.findOneAndUpdate(
      { _id: id, user: userId },
      { title, value },
      { new: true }
    ).lean();
    if (!note) {
      return res.status(404).json({ ok: false, message: "Note not found!" });
    }
    return res.status(200).json({ ok: true, note });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});

app.delete("/notes/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("User not found!");
    }
    const note = await NoteModel.findOneAndDelete(
      { _id: id, user: userId }
    ).lean();
    if (!note) {
      return res.status(404).json({ ok: false, message: "Note not found!" });
    }
    return res.status(200).json({ ok: true, message: "Note deleted successfully!" });
  } catch (e) {
    res.json({ ok: false, message: e.message || "Something went wrong!" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
