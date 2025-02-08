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
