const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email, password, verified: false });
    await user.save();
    res.status(201).json({ success: true, message: 'User created successfully. Please verify your email.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.verified) {
      return res.status(401).json({ success: false, message: 'Please verify your email before logging in.' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ 
      success: true, 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        role: user.role,
        verified: user.verified 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};