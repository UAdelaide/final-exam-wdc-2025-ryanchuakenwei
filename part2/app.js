const express = require('express');
const path = require('path');
const session = require('express-session');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

//Configuring database
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'DogWalkService',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}

const pool = mysql.createPool(dbConfig);
app.use(session({
    secret: process.env.SESSION_SECRET || 'key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to true
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));


// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '/public')));
app.use(express.urlencoded({
    extended: true
}));

// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);

//Authenticating middleware
const authenticate = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.session.user && req.session.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
};

// Login API endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Query database for user
    const [users] = await pool.query(
      'SELECT user_id, username, role FROM Users WHERE username = ? AND password_hash = ?',
      [username, password]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Store user in session
    req.session.user = {
      id: user.user_id,
      username: user.username,
      role: user.role
    };

    res.json({
      message: 'Login successful',
      userId: user.user_id,
      username: user.username,
      role: user.role
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ message: 'Logout successful' });
  });
});

// Current user session endpoint
app.get('/api/auth/current', (req, res) => {
  if (req.session.user) {
    res.json({
      loggedIn: true,
      userId: req.session.user.id,
      username: req.session.user.username,
      role: req.session.user.role
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// Protected routes for dashboards
app.get('/owner-dashboard.html', authenticate, requireRole('owner'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/owner-dashboard.html'));
});

app.get('/walker-dashboard.html', authenticate, requireRole('walker'), (req, res) => {
  res.sendFile(path.join(__dirname, 'public/walker-dashboard.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export the app instead of listening here
module.exports = app;