document.addEventListener("DOMContentLoaded", () => {
    // Utility function to update the building result and show the Continue button
    function displayBuildingResult(result) {
      const buildingResultElement = document.getElementById("building-result");
      const continueButton = document.getElementById("continue-button-1");
      buildingResultElement.innerText = result;
      continueButton.classList.add("show-button");
    }
  
    // --- Detect Building Automatically (Geolocation) ---
    document.getElementById("detect-location").addEventListener("click", function () {
      console.log("Detect My Building button clicked!");
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async position => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
          try {
            console.log(`Sending coordinates: Latitude ${latitude}, Longitude ${longitude}`);
            const response = await fetch("http://localhost:5000/detect-building", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ latitude, longitude })
            });
            console.log("Response received:", response);
            const data = await response.json();
            console.log("Data from server:", data);
            if (data.error) {
              document.getElementById("building-result").innerText = "Error: " + data.error;
            } else {
              displayBuildingResult("Detected Building: " + data.building);
            }
          } catch (error) {
            console.error("Error fetching building data:", error);
            document.getElementById("building-result").innerText = "Failed to fetch building data.";
          }
        }, error => {
          console.error("Geolocation error:", error);
          document.getElementById("building-result").innerText = "Unable to retrieve your location.";
        });
      } else {
        console.error("Geolocation is not supported by this browser.");
        document.getElementById("building-result").innerText = "Geolocation is not supported by your browser.";
      }
    });
  
    // --- Recognize Building from Manual Input ---
    document.getElementById("search-building").addEventListener("click", async function () {
      const buildingName = document.getElementById("address-input").value.trim();
      if (!buildingName) {
        document.getElementById("error-message").innerText = "Please enter a building name.";
        return;
      }
      try {
        const response = await fetch("http://localhost:5000/recognize-building", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingName })
        });
        const data = await response.json();
        if (data.error) {
          document.getElementById("error-message").innerText = data.error;
        } else {
          displayBuildingResult("Recognized Building: " + data.building);
          document.getElementById("error-message").innerText = "";
        }
      } catch (error) {
        console.error("Error recognizing building:", error);
        document.getElementById("error-message").innerText = "Error recognizing building. Try again.";
      }
    });
  
    // --- Fetch Real-Time Emergency Alerts ---
    document.getElementById("fetch-alerts").addEventListener("click", async function () {
      try {
        const response = await fetch("http://localhost:5000/emergency-alerts");
        const alerts = await response.json();
        const alertsList = document.getElementById("alerts-list");
        alertsList.innerHTML = ""; // Clear old alerts
        if (alerts.length === 0) {
          alertsList.innerHTML = "<li>No local alerts within your area.</li>";
        } else {
          alerts.slice(0, 5).forEach(alert => {
            const li = document.createElement("li");
            li.innerText = `${alert.declarationTitle} (${alert.state}) - ${alert.incidentType}`;
            alertsList.appendChild(li);
          });
        }
      } catch (error) {
        console.error("Error fetching emergency alerts:", error);
        document.getElementById("error-message").innerText = "Error fetching alerts. Try again.";
      }
    });
  
    // --- Continue Button for Navigation ---
    document.getElementById("continue-button-1").addEventListener("click", () => {
      triggerAnimation();
      // Clear the blue text (user's address)
      document.getElementById("building-result").innerText = "";
      // After the animation, reveal the evacuation controls
      setTimeout(() => {
        document.getElementById("evacuation-controls").style.display = "block";
      }, 600);
    });
    
    function triggerAnimation() {
      // Slide the header image to the left
      document.querySelector(".header-image").classList.add("slide-left");
      // Fade out controls
      document.getElementById("title").classList.add("hidden-left");
      document.getElementById("paragraph").classList.add("hidden-left");
      document.getElementById("detect-location").classList.add("hidden-left");
      document.getElementById("search-building").classList.add("hidden-left");
      document.getElementById("address-input").classList.add("hidden-left");
      document.getElementById("fetch-alerts").classList.add("hidden-right");
      document.getElementById("alerts-list").classList.add("hidden-right");
      document.querySelector(".columns-wrapper").classList.add("hide-line");
      // Show image container
      document.getElementById("image-container").classList.add("show-image");
      // After a delay, reveal dropdowns and 3D container
      setTimeout(() => {
        document.getElementById("dropdowns-container").classList.add("show-dropdowns");
        const threeContainer = document.getElementById("three-container");
        if (threeContainer) {
          threeContainer.style.opacity = 1;
          threeContainer.style.pointerEvents = "auto";
        }
      }, 600);
    }
    
    // --- Dropdown Functionality ---
    document.getElementById("dropdown-disability").addEventListener("change", checkDropdowns);
    document.getElementById("dropdown-emergencytype").addEventListener("change", checkDropdowns);
    
    function checkDropdowns() {
      const dropdown1 = document.getElementById("dropdown-disability").value;
      const dropdown2 = document.getElementById("dropdown-emergencytype").value;
      const continueButton = document.getElementById("continue-button-2");
      if (dropdown1 && dropdown2) {
        continueButton.classList.add("show-button");
      } else {
        continueButton.classList.remove("show-button");
      }
    }
    
    // --- Evacuation Instructions Functionality ---
    // This button remains clickable at any time.
    document.getElementById("get-evacuation").addEventListener("click", async () => {
      // Retrieve emergency type, accessibility, and floor input values
      const emergency = document.getElementById("dropdown-emergencytype").value || "Fire evacuation";
      const accessibility = document.getElementById("dropdown-disability").value || "";
      const floor = document.getElementById("floor-input").value.trim() || "1";
    
      const payload = {
        emergency,
        accessibility,
        floor
      };
    
      try {
        const response = await fetch("http://localhost:5000/evacuation-steps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.error) {
          document.getElementById("evacuation-result").innerText = "Error: " + data.error;
        } else {
          document.getElementById("evacuation-result").innerText = data.instructions;
        }
      } catch (error) {
        console.error("Error communicating with evacuation endpoint:", error);
        document.getElementById("evacuation-result").innerText = "There was an error processing your request.";
      }
    });
    
    // --- 3D Visualization Setup (using Three.js) ---
    // (Do not modify the 3D render code)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff, 1);
    renderer.domElement.style.left = "0";
    document.getElementById("three-container").appendChild(renderer.domElement);
    
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.5;
    controls.panSpeed = 0.5;
    
    const imagePaths = [
      'Images/fuqua_layout_slice_5.png',
      'Images/fuqua_layout_slice_4.png',
      'Images/fuqua_layout_slice_3.png',
      'Images/fuqua_layout_slice_2.png',
      'Images/fuqua_layout_slice_1.png',
      'Images/fuqua_layout_slice_0.png',
    ];
    
    const planes = [];
    const spacing = 1;
    imagePaths.forEach((path, index) => {
      const texture = new THREE.TextureLoader().load(path);
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
      const geometry = new THREE.PlaneGeometry(5, 5);
      const plane = new THREE.Mesh(geometry, material);
      plane.position.set(0, -index * spacing, 0);
      plane.rotation.x = Math.PI / 2;
      plane.rotation.z = -Math.PI / 2;
      scene.add(plane);
      planes.push(plane);
    });
    
    camera.position.set(5, 8, 5);
    camera.rotation.x = Math.PI / 1;
    controls.target.set(0, 0, -(planes.length * spacing) / 2);
    
    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
    
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  });
  