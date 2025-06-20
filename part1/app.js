const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mysql = require('mysql2/promise');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;
(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
    });

    await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await connection.end();

    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService'
    });

    await db.execute(`
        CREATE TABLE IF NOT EXISTS Users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('owner', 'walker') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS Dogs (
            dog_id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT NOT NULL,
            name VARCHAR(50) NOT NULL,
            size ENUM('small', 'medium', 'large') NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES Users(user_id)
        )`);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS WalkRequests (
            request_id INT AUTO_INCREMENT PRIMARY KEY,
            dog_id INT NOT NULL,
            requested_time DATETIME NOT NULL,
            duration_minutes INT NOT NULL,
            location VARCHAR(255) NOT NULL,
            status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
        )`);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS WalkApplications (
            application_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            CONSTRAINT unique_application UNIQUE (request_id, walker_id)
        )`);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS WalkRatings (
            rating_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            owner_id INT NOT NULL,
            rating INT CHECK (rating BETWEEN 1 AND 5),
            comments TEXT,
            rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            FOREIGN KEY (owner_id) REFERENCES Users(user_id),
            CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
        )`);

        const [rows] = await db.execute('SELECT COUNT(*) AS count FROM Users');
        if (rows[0].count === 0) {
            await db.execute(`
                INSERT INTO Users (username, email, password_hash, role) VALUES
                ('alice123', 'alice@example.com', 'hashed123', 'owner'),
                ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
                ('carol123', 'carol@example.com', 'hashed789', 'owner'),
                ('joshuawalker', 'joshua@example.com', 'hashedpassword123', 'walker'),
                ('aiden123', 'aiden@example.com', 'hashedpassword456', 'owner')
            `);

            await db.execute(`
                INSERT INTO Dogs (name, size, owner_id) VALUES
                ('Max', 'medium', (SELECT user_id FROM Users WHERE username = 'alice123')),
                ('Bella', 'small', (SELECT user_id FROM Users WHERE username = 'carol123')),
                ('Humzah', 'large', (SELECT user_id FROM Users WHERE username = 'aiden123')),
                ('Big Fella', 'small', (SELECT user_id FROM Users WHERE username = 'aiden123')),
                ('Small Fella', 'large', (SELECT user_id FROM Users WHERE username = 'aiden123'))
            `);

            await db.execute(`
                INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
                ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Humzah'), '2025-06-10 11:00:00', 30, 'Parklands', 'open'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Big Fella'), '2025-06-10 12:00:00', 30, 'Beachside Ave', 'accepted'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Small Fella'), '2025-06-10 14:00:00', 45, 'Parklands', 'open')
            `);

            console.log('Initial data inserted successfully');
        }

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
})();

function formatDateTime(dateTimeString) {
    if (!dateTimeString)
        return null;
    return new Date(dateTimeString).toISOString();
}

// API endpoint to fetch all dogs with their owner usernames
app.get('/api/dogs', async (req, res) => {
    try {
        const [dogs] = await db.execute(`
            SELECT d.name as dog_name, d.size, u.username AS owner_username
            FROM Dogs d
            JOIN Users u ON d.owner_id = u.user_id
            `);

            const dogsDisplay = dogs.map((dog) => ({
                dog_name: dog.dog_name,
                size: dog.size,
                owner_username: dog.owner_username
            }));
            res.json(dogsDisplay);
        }
        catch (err) {
            console.error('Error fetching dogs:', err);
            res.status(500).json({ error: 'Failed to fetch dogs' });
        }
    });

// to get all open walk requests
app.get('/api/walkrequests/open', async (req, res) => {
    try {
        const [requests] = await db.execute(`
            SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
            FROM WalkRequests wr
            JOIN Dogs d ON wr.dog_id = d.dog_id
            JOIN Users u on d.owner_id = u.user_id
            WHERE wr.status = 'open'
            `);

            const requestsDisplay = requests.map((request) => ({
                request_id: request.request_id,
                dog_name: request.dog_name,
                requested_time: formatDateTime(request.requested_time),
                duration_minutes: request.duration_minutes,
                location: request.location,
                owner_username: request.owner_username
            }));
            res.json(requestsDisplay);
        }
        catch (err) {
            console.error('Error fetching open walk requests:', err);
            res.status(500).json({ error: 'Failed to fetch open walk requests' });
        }
    });

// to get walking summary
app.get ('/api/walkers/summary', async (req, res) => {
    try {
        const [walkers] = await db.execute(`
            SELECT u.username,
            COUNT(wr.rating_id) AS total_ratings,
            AVG(wr.rating) AS average_rating
            FROM Users u
            LEFT JOIN WalkRatings wr ON u.user_id = wr.walker_id
            WHERE u.role = 'walker'
            GROUP BY u.user_id
            `);

        const walkersDisplay = walkers.map((walker) => ({
            walker_username: walker.username,
            total_ratings: walker.total_ratings,
            average_rating: walker.average_rating ? Number(walker.average_rating) : null,
            completed_walks: 0
        }));
        res.json(walkersDisplay);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch walker summary' });
    }
});

app.use(express.static(path.join(__dirname, 'public')));