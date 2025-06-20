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
