const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subscription: {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  }
});

//  Prevent duplicate subscriptions for the same user + endpoint
SubscriptionSchema.index(
  { userId: 1, "subscription.endpoint": 1 },
  { unique: true }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
