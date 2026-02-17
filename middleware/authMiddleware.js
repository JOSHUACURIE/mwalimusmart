
const jwt = require('jsonwebtoken');
const User = require('../models/User');


exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }


    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
 
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

 
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.'
        });
      }

    t
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};


exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Optional: Check if user is teacher (convenience method)
exports.isTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Only teachers can access this route'
    });
  }
  next();
};


exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Only admins can access this route'
    });
  }
  next();
};