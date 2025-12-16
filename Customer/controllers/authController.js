const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function tokenFor(customer) {
  return jwt.sign(
    {
      sub: customer.id,
      role: customer.role,
      email: customer.email,
    },
    JWT_SECRET,
    { expiresIn: '2h' },
  );
}

async function register(req, res, next) {
  try {
    const { name, email, phone, password, role, address } = req.body || {};

    if (!name || !email || !phone || !password || !address) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const requiredAddress =
      address.street && address.city && address.state && address.pincode && address.country;
    if (!requiredAddress) {
      return res
        .status(400)
        .json({ message: 'Address street, city, state, pincode, country are required' });
    }

    const existing = await Customer.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Customer already exists' });
    }

    const customer = await Customer.create({
      name,
      email,
      phone,
      password,
      role: role || 'customer',
      address,
    });

    return res.status(201).json({
      message: 'Customer created',
      token: tokenFor(customer),
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: customer.role,
        address: customer.address,
        createdAt: customer.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (customer.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.json({
      message: 'Login successful',
      token: tokenFor(customer),
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: customer.role,
        address: customer.address,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(_req, res, next) {
  try {
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  logout,
};

