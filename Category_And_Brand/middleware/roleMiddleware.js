/**
 * Role-based Authorization Middleware
 * Checks if the authenticated user has one of the required roles
 * @param {string[]} allowedRoles - Array of allowed roles
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Admin or Super Admin access required.',
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
};

