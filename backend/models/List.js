const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: {
    type: String,
    enum: ["owner", "editor", "viewer"],
    default: "viewer",
  },
});

const listSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [memberSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("List", listSchema);
