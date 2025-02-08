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
    document.getElementById("title").classList.add("hidden");
    document.getElementById("paragraph").classList.add("hidden");
    document.getElementById("detect-location").classList.add("hidden");
    document.getElementById("search-building").classList.add("hidden");
    document.getElementById("address-input").classList.add("hidden");

    // Show image container
    document.getElementById("image-container").classList.add("show-image");
}

