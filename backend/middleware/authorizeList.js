const List = require("../models/List");

function authorizeList(requiredRole = "editor") {
  return async (req, res, next) => {
    try {
      const listId = req.params.listId || req.body.listId;
      if (!listId) return res.status(400).json({ error: "listId required" });

      const list = await List.findById(listId);
      if (!list) return res.status(404).json({ error: "List not found" });

      
      if (String(list.owner) === String(req.user.id)) {
        req.list = list;
        return next();
      }

      // Check if user is a member
      const member = list.members.find(
        (m) => String(m.userId) === String(req.user.id)
      );
      if (!member) {
        return res.status(403).json({ error: "You are not a member of this list" });
      }

      // Role hierarchy
      const roles = ["viewer", "editor", "owner"];
      const hasRole =
        roles.indexOf(member.role) >= roles.indexOf(requiredRole);

      if (!hasRole) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      req.list = list; // attach list for downstream routes
      next();
    } catch (err) {
      console.error("Authorize error:", err);
      res.status(500).json({ error: "Server error" });
    }
  };
}

module.exports = authorizeList;
