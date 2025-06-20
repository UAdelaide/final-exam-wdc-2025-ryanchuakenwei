// Add this at the top with other imports
const session = require('express-session');

// Add session middleware after app initialization
app.use(session({
  secret: 'your_secret_key_here', // Change this to a strong secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Login API endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Query database for user
    const [users] = await db.execute(
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

// Authentication middleware
const authenticate = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Role-based access middleware
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.session.user && req.session.user.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
};

// Protected routes for dashboards
app.get('/owner-dashboard.html', authenticate, requireRole('owner'), (req, res) => {
  res.sendFile(path.join(__dirname, 'owner-dashboard.html'));
});

app.get('/walker-dashboard.html', authenticate, requireRole('walker'), (req, res) => {
  res.sendFile(path.join(__dirname, 'walker-dashboard.html'));
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

// Add this endpoint to check current session
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