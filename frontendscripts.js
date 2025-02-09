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
    //   document.getElementById("continue-button-1").classList.add("show-button"); // remove
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
    //   document.getElementById("continue-button-1").classList.add("show-button"); // remove
    });
  
    // --- Fetch Real-Time Emergency Alerts ---
    document.getElementById("fetch-alerts").addEventListener("click", async function () {
      try {
        const response = await fetch("http://localhost:5000/emergency-alerts");
        const alerts = await response.json();
        const alertsList = document.getElementById("alerts-list");
        alertsList.innerHTML = ""; // Clear old alerts
        if (alerts.length === 0) {
          alertsList.innerHTML = "<li>No current alerts.</li>";
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
  
    // Trigger animations when building detection or search is performed
    document.getElementById("continue-button-1").addEventListener("click", triggerAnimation);
    document.getElementById("search-building").addEventListener("click", triggerAnimation);
  
    function triggerAnimation() {
      // Slide the header image to the left
      document.querySelector(".header-image").classList.add("slide-left");
      // Fade out or move other elements
      document.getElementById("title").classList.add("hidden-left");
      document.getElementById("paragraph").classList.add("hidden-left");
      document.getElementById("detect-location").classList.add("hidden-left");
      document.getElementById("search-building").classList.add("hidden-left");
      document.getElementById("address-input").classList.add("hidden-left");
      document.getElementById("fetch-alerts").classList.add("hidden-right");
      document.getElementById("alerts-list").classList.add("hidden-right");
      // hide line
      document.querySelector(".columns-wrapper").classList.add("hide-line");
      
      //document.getElementById("continue-button-1").classList.add("show-button"); //remove later
      // Show the image container
      document.getElementById("image-container").classList.add("show-image");
      // Optionally, reveal additional options after a delay
      setTimeout(() => {
        document.getElementById("dropdowns-container").classList.add("show-dropdowns");
        
        const threeContainer = document.getElementById("three-container");

        // Trigger the fade-in animation
        threeContainer.style.opacity = 1;
        threeContainer.style.pointerEvents = "auto";
      }, 600);
    }
  
    // Dropdown functionality (if needed later)
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



    // 3D stuff maybe

    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffffff, 1);
    // renderer.domElement.style.position = "fixed"; // Fix it in place
    // renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    // // renderer.domElement.style.zIndex = "-1"; // Send it to the background
    // renderer.domElement.style.pointerEvents = "auto";
    document.getElementById("three-container").appendChild(renderer.domElement);

    // Add orbit controls for rotation and panning
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.rotateSpeed = 0.5;
    controls.panSpeed = 0.5;

    // Load images as textures and create planes
    const imagePaths = [
        'Images/fuqua_layout_slice_5.png', 'Images/fuqua_layout_slice_4.png',
        'Images/fuqua_layout_slice_3.png', 'Images/fuqua_layout_slice_2.png',
        'Images/fuqua_layout_slice_1.png', 'Images/fuqua_layout_slice_0.png',
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

    // Position the camera
    camera.position.set(5, 8, 5); // Move the camera up and back
    camera.rotation.x = Math.PI / 1;  // Tilt the camera downwards at an angle
    controls.target.set(0, 0, -(planes.length * spacing) / 2);

    // Handle window resizing
    window.addEventListener("resize", () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update();

        console.log(camera.position);

        renderer.render(scene, camera);
    }
    animate();





    // keep next line
  });
  