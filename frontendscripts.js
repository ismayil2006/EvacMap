document.addEventListener("DOMContentLoaded", () => {
    // Utility function to update the building result and show the Continue button
    function displayBuildingResult(result) {
      const buildingResultElement = document.getElementById("building-result");
      const continueButton = document.getElementById("continue-button");
      buildingResultElement.innerText = result;
      // Remove the "hidden" class (using display: none in CSS) to show the continue button
      continueButton.classList.remove("hidden");
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
    document.getElementById("detect-location").addEventListener("click", triggerAnimation);
    document.getElementById("search-building").addEventListener("click", triggerAnimation);
  
    function triggerAnimation() {
      // Slide the header image to the left
      document.querySelector(".header-image").classList.add("slide-left");
  
      // Add the "hidden-left" or "hidden-right" classes to fade out controls
      document.getElementById("title").classList.add("hidden-left");
      document.getElementById("paragraph").classList.add("hidden-left");
      document.getElementById("detect-location").classList.add("hidden-left");
      document.getElementById("search-building").classList.add("hidden-left");
      document.getElementById("address-input").classList.add("hidden-left");
      document.getElementById("fetch-alerts").classList.add("hidden-right");
  
      // Show the image container
      document.getElementById("image-container").classList.add("show-image");
  
      // Optionally, after a delay, you could reveal additional options
      setTimeout(() => {
        document.getElementById("dropdowns-container").classList.add("show-dropdowns");
      }, 600);
    
    }
  
    // Dropdown functionality (if needed later)
    document.getElementById("dropdown-disability").addEventListener("change", checkDropdowns);
    document.getElementById("dropdown-emergencytype").addEventListener("change", checkDropdowns);
  
    function checkDropdowns() {
      const dropdown1 = document.getElementById("dropdown-disability").value;
      const dropdown2 = document.getElementById("dropdown-emergencytype").value;
      const continueButton = document.getElementById("continue-button");
      if (dropdown1 && dropdown2) {
        continueButton.classList.add("show-button");
      } else {
        continueButton.classList.remove("show-button");
      }
    }
  });
  