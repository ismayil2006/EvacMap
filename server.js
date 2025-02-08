require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fetch = require('node-fetch');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Ensure MONGODB_URI is available
if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing from the .env file");
    process.exit(1); // Stop the server if MongoDB connection is missing
}

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1); // Stop the server if MongoDB fails to connect
    });

app.use(cors());
app.use(express.json());

// 🔹 Define Schema and Model for storing buildings
const buildingSchema = new mongoose.Schema({
    name: String,
    latitude: Number,
    longitude: Number,
    detectedAt: { type: Date, default: Date.now }
});

const Building = mongoose.model('Building', buildingSchema);

// 📍 Detect Building from GPS Coordinates (Improved)
app.post('/detect-building', async (req, res) => {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitude & longitude required" });
    }

    try {
        const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const fullName = response.data.display_name || "Unknown Location";

        // Extract only the first part (building name or landmark)
        const buildingName = fullName.split(",")[0];

        // ✅ Save detected building to MongoDB
        const newBuilding = new Building({ name: buildingName, latitude, longitude });
        await newBuilding.save();

        res.json({ building: buildingName });
    } catch (error) {
        console.error("Error detecting building:", error);
        res.status(500).json({ error: "Failed to detect building" });
    }
});

// 📍 Recognize Building from Manual Entry
app.post('/recognize-building', async (req, res) => {
    const { buildingName } = req.body;

    if (!buildingName) {
        return res.status(400).json({ error: "Building name required" });
    }

    try {
        // Search OpenStreetMap for the building name
        const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${buildingName}`);
        if (response.data.length === 0) {
            return res.status(404).json({ error: "Building not found" });
        }

        const { display_name, lat, lon } = response.data[0];

        // ✅ Save recognized building to MongoDB
        const newBuilding = new Building({ name: display_name, latitude: lat, longitude: lon });
        await newBuilding.save();

        res.json({ building: display_name, latitude: lat, longitude: lon });
    } catch (error) {
        console.error("Error recognizing building:", error);
        res.status(500).json({ error: "Failed to recognize building" });
    }
});

// 📍 Fetch Real-Time Emergency Alerts (Filtered by State)
app.get('/emergency-alerts', async (req, res) => {
    const { state } = req.query; // Example: ?state=NY
    try {
        const response = await fetch('https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries');
        const data = await response.json();

        // Filter alerts based on the requested state
        const filteredAlerts = state 
            ? data.DisasterDeclarationsSummaries.filter(alert => alert.state === state.toUpperCase())
            : data.DisasterDeclarationsSummaries;

        res.json(filteredAlerts);
    } catch (error) {
        console.error("Error fetching emergency alerts:", error);
        res.status(500).json({ error: "Failed to fetch emergency alerts" });
    }
});

// 📍 Retrieve All Stored Buildings from MongoDB
app.get('/stored-buildings', async (req, res) => {
    try {
        const buildings = await Building.find();
        res.json(buildings);
    } catch (error) {
        console.error("Error fetching stored buildings:", error);
        res.status(500).json({ error: "Failed to fetch buildings" });
    }
});

// 📍 Serve a Single Floor Plan (floorplan.geojson)
app.get('/floor-plan', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'maps', 'floorplan.geojson');
        res.sendFile(filePath);
    } catch (error) {
        res.status(404).json({ error: "Floor plan not found" });
    }
});

// 🔹 WebSocket Server Setup for Real-Time Updates
const server = app.listen(PORT, () => {
    console.log(`✅ SafeRoute Backend Running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    console.log('🔗 New WebSocket connection');

    // Fetch & Send Emergency Alerts Every 30 Seconds
    setInterval(async () => {
        try {
            const response = await fetch('https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries');
            const data = await response.json();
            ws.send(JSON.stringify(data.DisasterDeclarationsSummaries.slice(0, 5))); // Send top 5 alerts
        } catch (error) {
            console.error("Error fetching emergency alerts:", error);
        }
    }, 30000);

    ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
    });

    // Send a test message when a new client connects
    ws.send(JSON.stringify({ message: "Welcome to SafeRoute WebSocket!" }));
});
