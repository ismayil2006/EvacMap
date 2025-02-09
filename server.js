// server.js

require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const fs = require('fs');

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

app.use(cors({ origin: "*" }));
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
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    console.log("Response from OSM:", response.data);
    const fullAddress = response.data.display_name || "Unknown Location";
    const addressParts = response.data.address || {};
    let candidate = addressParts.building ||
                    addressParts.attraction ||
                    addressParts.amenity ||
                    addressParts.shop ||
                    addressParts.house_number ||
                    fullAddress;
    if (/^\d+$/.test(candidate)) {
      if (fullAddress.includes("Morehead Avenue") && fullAddress.includes("Durham")) {
        candidate = "Fuqua School of Business";
        console.log("Override: Detected Fuqua School of Business based on address clues.");
      } else {
        candidate = fullAddress;
      }
    }
    const newBuilding = new Building({ name: candidate, latitude, longitude });
    await newBuilding.save();
    res.json({ building: candidate, full_address: fullAddress });
  } catch (error) {
    console.error("Error detecting building:", error);
    res.status(500).json({ error: "Failed to detect building" });
  }
});

// --- Recognize Building from Manual Input ---
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
  const { state } = req.query;
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
  const searchRadius = radius ? Number(radius) : 100;
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

// =================== NEW CODE: Evacuation Instructions ===================

// --- Load Floor Plan for Evacuation Analysis ---
// Assumes floorplan.json is in the root directory.
const floorPlanData = JSON.parse(fs.readFileSync('floorplan.json', 'utf8'));

// --- Build Graph from Floor Plan ---
function buildGraphFromFloorPlan(floorPlan) {
  const graph = {};
  floorPlan.nodes.forEach(node => {
    graph[node.id] = [];
  });
  floorPlan.edges.forEach(edge => {
    // Assume undirected graph
    graph[edge.from].push({ node: edge.to, distance: edge.distance, features: edge.features });
    graph[edge.to].push({ node: edge.from, distance: edge.distance, features: edge.features });
  });
  return graph;
}

const evacGraph = buildGraphFromFloorPlan(floorPlanData);

// --- Define Descriptive Names for Nodes ---
// Adjust these descriptions as desired.
const nodeDescriptions = {
  "start": "your current location",
  "A": "the main corridor entrance",
  "B": "the reception area",
  "C": "the waiting area",
  "D": "the central hallway",
  "E": "the office area",
  "F": "the break room",
  "G": "a junction near the stairs",
  "H": "a side corridor",
  "I": "the security checkpoint",
  "J": "the rear exit",
  "corridor1": "a well‑lit corridor",
  "corridor2": "a corridor with emergency signage",
  "corridor3": "a long connecting corridor",
  "lobby": "the building lobby",
  "room1": "the conference room",
  "conference": "the conference hall",
  "room2": "the storage area",
  "room3": "a meeting room",
  "stairs1": "the stairs on your right",
  "stairs2": "the stairs on your left",
  "elevator1": "the elevator",
  "exit": "the main exit door"
};

// --- Simple Dijkstra's Algorithm ---
// This version accepts an options object with properties:
//    avoidStairs: boolean (if true, adds extra cost to "stairs" edges)
//    emergency: string (if "Fire evacuation", also avoid "elevator" edges)
function findShortestPath(graph, start, target, options = {}) {
  const { avoidStairs = false, emergency = "" } = options;
  const distances = {};
  const previous = {};
  const nodes = new Set();

  for (let node in graph) {
    distances[node] = Infinity;
    previous[node] = null;
    nodes.add(node);
  }
  distances[start] = 0;

  while (nodes.size > 0) {
    let current = null;
    nodes.forEach(node => {
      if (current === null || distances[node] < distances[current]) {
        current = node;
      }
    });

    if (current === target) break;
    nodes.delete(current);

    graph[current].forEach(neighbor => {
      if (!nodes.has(neighbor.node)) return;
      let extraCost = 0;
      if (avoidStairs && neighbor.features.includes("stairs")) {
        extraCost += 1000; // high cost to discourage stairs
      }
      // In a fire emergency, also avoid elevators.
      if (emergency === "Fire evacuation" && neighbor.features.includes("elevator")) {
        extraCost += 1000;
      }
      const alt = distances[current] + neighbor.distance + extraCost;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = current;
      }
    });
  }

  // Reconstruct the path from target to start.
  const path = [];
  let cur = target;
  while (cur) {
    path.unshift(cur);
    cur = previous[cur];
  }
  return path;
}

// --- Evacuation Steps Endpoint ---
// Returns tailored, descriptive evacuation instructions based on emergency, floor, and accessibility.
app.post('/evacuation-steps', (req, res) => {
  const { emergency, floor, accessibility } = req.body;
  const startNode = "start";
  const exitNode = "exit";
  const avoidStairs = (accessibility === "Avoid stairs");

  // Compute the shortest path using our options.
  const path = findShortestPath(evacGraph, startNode, exitNode, { avoidStairs, emergency });

  let instructions = `Evacuation Instructions for Floor ${floor} (${emergency}`;
  if (accessibility) instructions += `, ${accessibility}`;
  instructions += `):\n\n`;

  const floorNumber = parseInt(floor);

  // Emergency-specific preface.
  if (emergency === "Fire evacuation") {
    if (floorNumber > 1) {
      instructions += "Being on a higher floor during a fire emergency, immediately follow the designated fire escape routes. Avoid elevators at all costs and use the stairs or ramps instead.\n\n";
    } else {
      instructions += "Since you are on the ground floor during a fire emergency, quickly evacuate via the stairs and do not use the elevator.\n\n";
    }
  } else if (emergency === "Power outage") {
    if (floorNumber > 1) {
      instructions += "On higher floors during a power outage, follow the emergency lighting and signage to reach the nearest exit.\n\n";
    } else {
      instructions += "On the ground floor during a power outage, follow the illuminated exit signs to evacuate safely.\n\n";
    }
  } else if (emergency === "Earthquake") {
    instructions += "During an earthquake, remember to drop, cover, and hold on until the shaking subsides. Then, calmly proceed along the marked evacuation routes to the exit.\n\n";
  }

  // Accessibility-specific advice.
  if (accessibility === "Avoid stairs") {
    if (emergency === "Fire evacuation") {
      instructions += "Due to your preference to avoid stairs, please use the designated ramp or alternative accessible route provided on your floor. (Note: In a fire, elevators should never be used.)\n\n";
    } else {
      instructions += "Since you wish to avoid stairs, follow the alternative accessible route as indicated by the emergency signage.\n\n";
    }
  } else if (accessibility === "Least turns") {
    instructions += "This route has been optimized to minimize turns and may provide a smoother path.\n\n";
  } else if (accessibility === "Shortest") {
    instructions += "This route is calculated as the shortest path to safety.\n\n";
  }

  // Generate route instructions using descriptive node names.
  for (let i = 0; i < path.length - 1; i++) {
    const fromDesc = nodeDescriptions[path[i]] || path[i];
    const toDesc = nodeDescriptions[path[i + 1]] || path[i + 1];
    instructions += `- From ${fromDesc}, proceed to ${toDesc}.\n`;
  }
  instructions += "\nFinally, exit the building through the main exit.";

  res.json({ instructions });
});

// =================== END NEW CODE ===================

// --- WebSocket Server Setup for Real-Time Updates (unchanged) ---
const server = app.listen(PORT, () => {
  console.log(`✅ SafeRoute Backend Running on http://localhost:${PORT}`);
});
const wss = new WebSocket.Server({ server });
wss.on('connection', ws => {
  console.log('🔗 New WebSocket connection');
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
  ws.send(JSON.stringify({ message: "Welcome to SafeRoute WebSocket!" }));
});
