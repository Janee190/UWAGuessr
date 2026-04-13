// Hardcoded locations 
const uwaLocations = [
    {
        id: 1,
        imagePath: "game/photos/PXL_20251004_090913529.RAW-01.MP.COVER.jpg", // You'll need to add these images
        lat: -31.978181, 
        lng: 115.818514    
    },
    {
        id: 2,
        imagePath: "game/photos/PXL_20251110_021331671.RAW-01.MP.COVER.jpg",
        lat: -31.979886,
        lng: 115.818733
    },
    {
        id: 3,
        imagePath: "game/photos/PXL_20251112_084644050.RAW-01.MP.COVER.jpg",
        lat: -31.978253,
        lng: 115.817886
    },    
    {
        id: 4,
        imagePath: "game/photos/PXL_20251119_155927971.RAW-01.MP.COVER.jpg",
        lat: -31.976600,
        lng: 115.818294
    }
];

// WRAPPER: Get a specific round's data
function getRoundData(roundIndex) {
    if (roundIndex < uwaLocations.length) {
        return uwaLocations[roundIndex];
    }
    return null; // Signals end of game
}

// WRAPPER: Get total number of rounds
function getTotalRounds() {
    return uwaLocations.length;
}