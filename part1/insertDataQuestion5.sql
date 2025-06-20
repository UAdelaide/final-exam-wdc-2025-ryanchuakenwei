USE DogWalkService;

-- Inserting Users
INSERT INTO Users (username, email, password_hash, role) VALUES
('alice123', 'alice@example.com', 'hashed123', 'owner'),
('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
('carol123', 'carol@example.com', 'hashed789', 'owner'),
('joshuawalker', 'joshua@example.com', 'hashedpassword123', 'walker'),
('aiden123', 'aiden@example.com', 'hashedpassword456', 'owner');

-- Inserting Dogs
INSERT INTO Dogs (name, size, owner_id) VALUES
('Max', 'medium', (SELECT user_id FROM Users WHERE username = 'alice123')),
('Bella', 'small', (SELECT user_id FROM Users WHERE username = 'carol123')),
('Humzah', 'large', (SELECT user_id FROM Users WHERE username = 'aiden123')),
('Big Fella', 'small', (SELECT user_id FROM Users WHERE username = 'aiden123')),
('Small Fella', 'large', (SELECT user_id FROM Users WHERE username = 'aiden123'));

-- Walk Requests
INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
((SELECT dog_id FROM Dogs WHERE name = 'Bella'), ))
