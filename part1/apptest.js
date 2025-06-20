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

const fs = require('fs');
const path = require ('path');

let db;
(async () => {
  try {
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      multipleStatements: true
    });

    await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
    await connection.end();

    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService',
      multipleStatements: true
    });

    const schemaPath = path.join(__dirname, 'dogwalks.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    await db.query(schemaSQL);

    const [rows] = await db.execute('SELECT COUNT(*) AS count FROM Users');
    if (rows[0].count === 0) {
        const dataPath = path.join(__dirname, 'insertDataQuestion5.sql');
        const dataSQL = fs.readFileSync(dataPath, 'utf8');
        await db.query(dataSQL);
        console.log('Sample data inserted successfully.');
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