const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription");
const auth = require("../middleware/auth");

router.post("/", auth, async (req, res) => {
  try {

    // Accept either wrapped or unwrapped subscription
    const subscription = req.body.subscription || req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    // Validate subscription structure
    const { endpoint, keys } = subscription;
    if (!keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: "Missing required subscription keys" });
    }

    // Validate endpoint format
    let isValidEndpoint = false;
    const isFCM = endpoint.includes('fcm.googleapis.com');
    const isWNS = endpoint.includes('notify.windows.com');
    const isSafari = endpoint.includes('webkit');
    const isMozilla = endpoint.includes('mozilla');

    if (isFCM || isWNS || isSafari || isMozilla) {
      isValidEndpoint = true;
    }

    if (!isValidEndpoint) {
    }

    const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : isSafari ? 'Safari' : isMozilla ? 'Firefox' : 'Unknown';

    // Prevent duplicates by upserting on (userId + endpoint)
    const result = await Subscription.findOneAndUpdate(
      { userId: req.user.id, "subscription.endpoint": subscription.endpoint },
      { $set: { subscription, browserType, lastUpdated: new Date() } },
      { upsert: true, new: true }
    );


    res.status(201).json({
      message: "Subscription saved/updated",
      browserType,
      endpointType: isFCM ? 'FCM' : isWNS ? 'WNS' : isSafari ? 'Safari' : 'Unknown'
    });
  } catch (err) {
    console.error("❌ Subscription save error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Clean up invalid subscriptions (called when notifications fail)
router.delete("/cleanup/:userId/:endpoint", auth, async (req, res) => {
  try {
    const { userId, endpoint } = req.params;

    // Only allow users to clean up their own subscriptions
    if (req.user.id !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const decodedEndpoint = decodeURIComponent(endpoint);
    const result = await Subscription.findOneAndDelete({
      userId: req.user.id,
      "subscription.endpoint": decodedEndpoint
    });

    if (result) {
      
      res.json({ message: "Subscription cleaned up" });
    } else {
      res.status(404).json({ error: "Subscription not found" });
    }
  } catch (err) {
    console.error("❌ Subscription cleanup error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get subscription stats for debugging
router.get("/stats", auth, async (req, res) => {
  try {
    const stats = await Subscription.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: "$browserType",
          count: { $sum: 1 },
          latest: { $max: "$lastUpdated" }
        }
      }
    ]);

    res.json({
      total: stats.reduce((sum, stat) => sum + stat.count, 0),
      byBrowser: stats
    });
  } catch (err) {
    console.error("❌ Subscription stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
