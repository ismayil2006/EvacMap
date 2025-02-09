require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fetch = require('node-fetch');
const WebSocket = require('ws');

// Additional dependencies for converting OSM XML to GeoJSON
const osmtogeojson = require('osmtogeojson');
const { DOMParser } = require('xmldom');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure MONGODB_URI is available
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing from the .env file");
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

app.use(cors({ origin: "*" })); // Allow all origins
app.use(express.json());

// Define Schema and Model for storing buildings
const buildingSchema = new mongoose.Schema({
  name: String,
  latitude: Number,
  longitude: Number,
  detectedAt: { type: Date, default: Date.now }
});
const Building = mongoose.model('Building', buildingSchema);

// --- Detect Building from GPS Coordinates with Fallback Logic ---
app.post('/detect-building', async (req, res) => {
  console.log("Received detect-building request:", req.body);
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    console.error("Missing latitude or longitude in request.");
    return res.status(400).json({ error: "Latitude & longitude required" });
  }

  try {
    // Query OSM Nominatim for reverse geocoding
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    console.log("Response from OSM:", response.data);

    const fullAddress = response.data.display_name || "Unknown Location";
    const addressParts = response.data.address || {};

    // Build a candidate building name from various address parts
    let candidate = addressParts.building ||
                    addressParts.attraction ||
                    addressParts.amenity ||
                    addressParts.shop ||
                    addressParts.house_number ||
                    fullAddress;
    
    // If candidate is purely numeric, then check if the fullAddress contains clues that it is Fuqua
    if (/^\d+$/.test(candidate)) {
      // For example, if the full address contains "Morehead Avenue" and "Durham"
      if (fullAddress.includes("Morehead Avenue") && fullAddress.includes("Durham")) {
        candidate = "Fuqua School of Business";
        console.log("Override: Detected Fuqua School of Business based on address clues.");
      } else {
        // Otherwise, fallback to the fullAddress
        candidate = fullAddress;
      }
    }

    // Optionally, save the detected building to MongoDB
    const newBuilding = new Building({ name: candidate, latitude, longitude });
    await newBuilding.save();

    res.json({ building: candidate, full_address: fullAddress });
  } catch (error) {
    console.error("Error detecting building:", error);
    res.status(500).json({ error: "Failed to detect building" });
  }
});

// --- Recognize Building from Manual Entry ---
app.post('/recognize-building', async (req, res) => {
  const { buildingName } = req.body;

  if (!buildingName) {
    return res.status(400).json({ error: "Building name required" });
  }

  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${buildingName}`
    );
    if (response.data.length === 0) {
      return res.status(404).json({ error: "Building not found" });
    }

    const { display_name, lat, lon } = response.data[0];
    const newBuilding = new Building({ name: display_name, latitude: lat, longitude: lon });
    await newBuilding.save();

    res.json({ building: display_name, latitude: lat, longitude: lon });
  } catch (error) {
    console.error("Error recognizing building:", error);
    res.status(500).json({ error: "Failed to recognize building" });
  }
});

// --- Fetch Real-Time Emergency Alerts (Filtered by State) ---
app.get('/emergency-alerts', async (req, res) => {
  const { state } = req.query; // Example: ?state=NY
  try {
    const response = await fetch('https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries');
    const data = await response.json();

    const filteredAlerts = state 
      ? data.DisasterDeclarationsSummaries.filter(alert => alert.state === state.toUpperCase())
      : data.DisasterDeclarationsSummaries;

    res.json(filteredAlerts);
  } catch (error) {
    console.error("Error fetching emergency alerts:", error);
    res.status(500).json({ error: "Failed to fetch emergency alerts" });
  }
});

// --- Retrieve All Stored Buildings from MongoDB ---
app.get('/stored-buildings', async (req, res) => {
  try {
    const buildings = await Building.find();
    res.json(buildings);
  } catch (error) {
    console.error("Error fetching stored buildings:", error);
    res.status(500).json({ error: "Failed to fetch buildings" });
  }
});

// --- Serve a Single Floor Plan (floorplan.geojson) ---
app.get('/floor-plan', async (req, res) => {
  try {
    const filePath = path.join(__dirname, 'maps', 'floorplan.geojson');
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: "Floor plan not found" });
  }
});

// --- Fetch Indoor Map Data from OSM using Overpass API ---
app.get('/indoor-map', async (req, res) => {
  const { lat, lon, radius } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and longitude are required as query parameters' });
  }
  const searchRadius = radius ? Number(radius) : 100; // default radius: 100 meters

  const query = `
    [out:xml];
    (
      node["indoor"](around:${searchRadius},${lat},${lon});
      way["indoor"](around:${searchRadius},${lat},${lon});
      relation["indoor"](around:${searchRadius},${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;
  const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(overpassUrl);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, "text/xml");
    const geojson = osmtogeojson(xmlDoc);
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return res.status(404).json({ error: "No indoor map data found for this location" });
    }
    res.json(geojson);
  } catch (error) {
    console.error("Error fetching indoor map data:", error);
    res.status(500).json({ error: "Failed to fetch indoor map data" });
  }
});

// --- WebSocket Server Setup for Real-Time Updates ---
const server = app.listen(PORT, () => {
  console.log(`✅ SafeRoute Backend Running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });
wss.on('connection', ws => {
  console.log('🔗 New WebSocket connection');

  // Fetch and send top 5 FEMA alerts every 30 seconds
  setInterval(async () => {
    try {
      const response = await fetch('https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries');
      const data = await response.json();
      ws.send(JSON.stringify(data.DisasterDeclarationsSummaries.slice(0, 5)));
    } catch (error) {
      console.error("Error fetching emergency alerts:", error);
    }
  }, 30000);

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });

  // Send a welcome message when a new client connects
  ws.send(JSON.stringify({ message: "Welcome to SafeRoute WebSocket!" }));
});
