/*
|--------------------------------------------------------------------------
| 1. DOM Element and Module Imports/References
|--------------------------------------------------------------------------
| Get references to all necessary DOM elements and import ArcGIS modules.
*/

// --- DOM References for Sliders and Output ---
const opacityInput = document.getElementById('sliderDiv');
const rangeOutput = document.getElementById('rangeValue');
const dateSlider_l = document.getElementById('dateSlider_l');
const dateSlider_r = document.getElementById('dateSlider_r');
const dateMinValue = document.getElementById('dateMinValue');
const dateMaxValue = document.getElementById('dateMaxValue');

// --- DOM References for Map/View and Sidebar ---
const viewElement = document.querySelector("arcgis-map"); // The <arcgis-map> web component
const featureNode = document.querySelector("#feature-node"); // The sidebar/results panel
const expandCollapse = document.querySelector("#expandCollapse"); // Sidebar toggle button
const collapseIcon = document.getElementById('collapse-icon');
const expandIcon = document.getElementById('expand-icon');

// --- DOM References for Search and Results ---
const searchBar = document.querySelector("#searchBar");
const searchButton = document.querySelector("#searchButton");
const resultsList = document.querySelector("#result-list"); // Map results <ul>
const pointsList = document.querySelector("#point-list"); // Point results <ul>
const pointListElement = document.getElementById("point-list");
const mapsInfo = document.getElementById('mapsInfo'); // Map detail display div
const pointsInfo = document.getElementById('pointsInfo'); // Point detail display div
const mapsCounter = document.getElementById("mapsCounter"); // Maps tab counter
const pointsCounter = document.getElementById("pointsCounter"); // Places tab counter
const defaultOption = document.querySelector("#defaultOption"); // Default map list item
const defaultPointOption = document.querySelector("#defaultPointOption"); // Default point list item

// --- DOM References for Filters/Controls ---
const pointsFilterMenu = document.querySelector("#pointsFilter"); // Filter button group
const pointsSwitch = document.querySelector("calcite-switch"); // Points visibility switch
// const selectFilter = document.querySelector("#sqlSelect"); // (Commented out/Unused element)

// --- Global State Variables ---
let whereClause = defaultOption.value; // SQL filter for maps layer
let wherePointClause = defaultPointOption.value; // SQL filter for points layer (currently unused)
let highlight; // Reference to feature highlight handler
let objectId; // Placeholder for feature OBJECTID
let clickedGraphic = null;
let currentHighlight = null; // Reference to the active graphic highlight
let tileLayer; // Reference to the dynamically loaded historic TileLayer
let sliderTimeout; // For debouncing the date range slider
let timeout; // For debouncing map extent changes

// --- ArcGIS Module Imports (Async) ---
const FeatureLayer = await $arcgis.import("@arcgis/core/layers/FeatureLayer.js");
const TileLayer = await $arcgis.import("@arcgis/core/layers/TileLayer.js");

/*
|--------------------------------------------------------------------------
| 2. Layer Definitions and Renderers
|--------------------------------------------------------------------------
| Define feature layers and their symbology/popups.
*/

// --- Historic Map Index FeatureLayer ---
const parcelLayer = new FeatureLayer({
    url: "https://portal1-geo.sabu.mtu.edu/server/rest/services/Hosted/map_index/FeatureServer/0",
});

// --- Points Layer Renderer (Symbology) ---
const sizeVV = {
    type: "size",
    valueExpression: "$view.scale",
    // Define marker size stops based on map scale (Zoom Level)
    stops: [
        { size: 12, value: 70 },
        { size: 9, value: 564 },
        { size: 5, value: 4513 },
        { size: 4, value: 36111 },
        { size: 2, value: 144447},
        { size: 1, value: 4622324},
    ],
};

const pointsRenderer = {
    type: "simple",
    visualVariables: [sizeVV],
    symbol: {
        type: "simple-marker",
        style: "circle",
        color: "#660000",
        size: 7.0,
        outline: {
            color: "#bfa87c",
            width: 1
        }
    }
};

// --- Point FeatureLayer (Sanborn 1902) ---
const pointsLayer = new FeatureLayer({
    url: "https://lyre.cofc.edu/server/rest/services/shoc/pl_sanborn1902/FeatureServer/0",
    outFields: ["prime_material", "function_prime", "place_descript", "orig_address_no", "orig_address_street", "orig_city", "OBJECTID"],
    // popupTemplate: popupPoints, // (Commented out in original)
    renderer: pointsRenderer,
});

/*
|--------------------------------------------------------------------------
| 3. Main ArcGIS View Setup (arcgisViewReadyChange Listener)
|--------------------------------------------------------------------------
| Code block executed once the map component has initialized its view.
*/
viewElement.addEventListener("arcgisViewReadyChange", () => {
    // Add the points layer to the map
    viewElement.map.add(pointsLayer, 1);

    // --- Debounce Functionality ---

    // Watch map extent changes to trigger data refresh
    viewElement.view.watch("extent", (extent) => {
        debounceQuery(extent);
    });

    // A simple debounce function to limit how often a function is called
    function debounceQuery(extent) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            queryCount(extent); // Refresh map list based on extent
            queryPoints(searchBar.value.trim()); // Refresh point list based on search/filters
        }, 500); // Wait 500ms after the user stops panning/zooming
    }

    // --- Event Listeners: Map Interactions ---

    // Handle map clicks (HitTest) for selecting points
    viewElement.view.on("click", (event) => {
        viewElement.view.hitTest(event).then(function(response) {
            const result = response.results.length > 0 ? response.results[0] : null;

            // Clear the previous highlight
            if (currentHighlight) {
                currentHighlight.remove();
            }

            if (result && result.graphic.layer === pointsLayer) {
                const graphic = result.graphic;
                const attributes = graphic.attributes;

                // Highlight the clicked point
                viewElement.view.whenLayerView(pointsLayer).then((layerView) => {
                    currentHighlight = layerView.highlight(graphic);
                });

                // Populate sidebar and show the 'Places' tab
                if (attributes.orig_city !== undefined) {
                    const contentHTML = `
                        <h3>${attributes.orig_address_no} ${attributes.orig_address_street}</h3>
                        <b>Original Street Address:</b> ${attributes.orig_address_no} ${attributes.orig_address_street}<br>
                        <b>Municipality:</b> ${attributes.orig_city}<br>
                        <b>Primary Material:</b> ${attributes.prime_material}<br>
                        <b>Primary Function:</b> ${attributes.function_prime}<br>
                        <b>Place Description:</b> ${attributes.place_descript}<br>
                        <b>Source:</b> 1902 Sanborn
                    `;
                    pointsInfo.innerHTML = contentHTML;

                    // Ensure sidebar is open and tab is selected
                    featureNode.style.display = "block";
                    featureNode.style.width= "25vw";
                    viewElement.style.width="75vw";
                    collapseIcon.style.display = "block";
                    expandIcon.style.display = "none";
                    $('#pointsCounter').tab('show'); // Use jQuery/Bootstrap to switch tab
                }
            } else {
                // Clicked on empty space or a non-points layer
                pointsInfo.innerHTML = "No point selected";
            }
        });
    });

    // --- Event Listeners: Sidebar and Search ---

    // Listener for Point List Item Click (to zoom/highlight)
    pointListElement.addEventListener("
