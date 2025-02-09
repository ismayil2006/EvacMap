document.getElementById("detect-location").addEventListener("click", function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            alert(`Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`);
            // You can send these coordinates to an API for building detection
        }, () => {
            alert("Unable to retrieve your location.");
        });
    } else {
        alert("Geolocation is not supported by your browser.");
    }
});

document.getElementById("detect-location").addEventListener("click", triggerAnimation);
document.getElementById("search-building").addEventListener("click", triggerAnimation);

function triggerAnimation() {
    // Apply the class to make the title image slide left
    document.querySelector(".header-image").classList.add("slide-left");

    // Add hidden class to other elements (title, buttons, input)
    document.getElementById("title").classList.add("hidden-left");
    document.getElementById("paragraph").classList.add("hidden-left");
    document.getElementById("detect-location").classList.add("hidden-left");
    document.getElementById("search-building").classList.add("hidden-left");
    document.getElementById("address-input").classList.add("hidden-left");
    document.getElementById("fetch-alerts").classList.add("hidden-right");

    // Show image container
    document.getElementById("image-container").classList.add("show-image");

    // Show the dropdowns after the initial elements fade out
    setTimeout(() => {
        document.getElementById("dropdowns-container").classList.add("show-dropdowns");
    }, 600); // 600ms to match the timing of the initial animation   
}

document.getElementById("dropdown-disability").addEventListener("change", checkDropdowns);
document.getElementById("dropdown-emergencytype").addEventListener("change", checkDropdowns);

function checkDropdowns() {
    const dropdown1 = document.getElementById("dropdown-disability").value;
    const dropdown2 = document.getElementById("dropdown-emergencytype").value;
    const continueButton = document.getElementById("continue-button");

    if (dropdown1 && dropdown2) {
        continueButton.classList.add("show-button"); // Show button
    } else {
        continueButton.classList.remove("show-button"); // Hide button if not both selected
    }
}
