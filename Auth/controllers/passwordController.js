const jwt = require('jsonwebtoken');
const { generateToken } = require('../../utils/auth');
const SuperAdmin = require('../../Super_Admin/models/SuperAdmin');
const Admin = require('../../Admin/models/Admin');
const Vendor = require('../../Vendor/models/Vendor');
const Customer = require('../../Customer/models/Customer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function inFuture(minutes = 60) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function findUserByEmail(email) {
  const userTypes = [
    { model: SuperAdmin, role: 'super-admin' },
    { model: Admin, role: 'admin' },
    { model: Vendor, role: 'vendor' },
    { model: Customer, role: 'customer' },
  ];
  for (const userType of userTypes) {
    const user = await userType.model.findOne({ email });
    if (user) {
      return { user, role: userType.role };
    }
  }
  return null;
}

async function findUserByResetToken(token) {
  const now = new Date();
  const userTypes = [
    { model: SuperAdmin, role: 'super-admin' },
    { model: Admin, role: 'admin' },
    { model: Vendor, role: 'vendor' },
    { model: Customer, role: 'customer' },
  ];
  for (const userType of userTypes) {
    const user = await userType.model.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gte: now },
    });
    if (user) {
      return { user, role: userType.role, model: userType.model };
    }
  }
  return null;
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const found = await findUserByEmail(email);
    if (!found) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a random token and wrap it in a signed JWT
    const rawToken = generateToken();
    const token = jwt.sign(
      {
        sub: found.user.id,
        role: found.role,
        resetToken: rawToken,
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Store the JWT in the user document so we can later match it exactly
    found.user.resetToken = token;
    found.user.resetTokenExpiresAt = inFuture(60);
    await found.user.save();

    // In a real app, email the token. Here we return it for simplicity.
    return res.json({
      message: 'Reset token generated',
      role: found.role,
      token,
      expiresAt: found.user.resetTokenExpiresAt,
    });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Token and newPassword are required' });
    }

    const found = await findUserByResetToken(token);
    if (!found) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    found.user.password = newPassword;
    found.user.resetToken = undefined;
    found.user.resetTokenExpiresAt = undefined;
    await found.user.save();

    return res.json({
      message: 'Password reset successful',
      role: found.role,
      user: {
        id: found.user.id,
        email: found.user.email,
        role: found.role,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  forgotPassword,
  resetPassword,
};

