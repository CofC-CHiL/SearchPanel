// ====================================================================
// 1. VARIABLE DECLARATIONS (DOM Elements and ArcGIS Imports)
// ====================================================================

// DOM Element References (Sliders & Map Interaction)
const opacityInput = document.getElementById('sliderDiv'); // Opacity range input for historic map
const rangeOutput = document.getElementById('rangeValue'); // Opacity value display
const viewElement = document.querySelector("arcgis-map"); // The main map component
const dateSlider_l = document.getElementById('dateSlider_l'); // Left handle of the date range slider (min year)
const dateSlider_r = document.getElementById('dateSlider_r'); // Right handle of the date range slider (max year)
const dateMinValue = document.getElementById('dateMinValue'); // Min year display
const dateMaxValue = document.getElementById('dateMaxValue'); // Max year display
const searchBar = document.querySelector("#searchBar"); // Map/points search input field
const searchButton = document.querySelector("#searchButton"); // Map/points search button

// DOM Element References (Sidebar/Results)
const featureNode = document.querySelector("#feature-node"); // The sidebar container
const expandCollapse = document.querySelector("#expandCollapse"); // Button to show/hide the sidebar
const collapseIcon = document.getElementById('collapse-icon'); // Icon for 'collapse' state
const expandIcon = document.getElementById('expand-icon'); // Icon for 'expand' state
const pointsFilterMenu = document.querySelector("#pointsFilter"); // Radio button group for point filtering
const pointsSwitch = document.querySelector("calcite-switch"); // Switch to toggle points layer visibility
const resultsList = document.querySelector("#result-list"); // UL for Map results (maps tab)
const pointsList = document.querySelector("#point-list"); // UL for Point results (places tab)
const pointListElement = document.getElementById("point-list"); // Reference for point list
const mapsInfo = document.getElementById('mapsInfo'); // Div to display selected map information
const mapsCounter = document.getElementById("mapsCounter"); // Tab link for Maps count
const pointsCounter = document.getElementById("pointsCounter"); // Tab link for Places count
const pointsInfo = document.getElementById('pointsInfo'); // Div to display selected point information

// ArcGIS Imports & Layer-related Variables
const FeatureLayer = await $arcgis.import("@arcgis/core/layers/FeatureLayer.js");
const TileLayer = await $arcgis.import("@arcgis/core/layers/TileLayer.js");
const defaultOption = document.querySelector("#defaultOption");
const defaultPointOption = document.querySelector("#defaultPointOption");
let whereClause = defaultOption.value; // Query string for historic map filter
let wherePointClause = defaultPointOption.value; // Query string for points filter (not used consistently)
const zoom = viewElement.zoom; // Initial map zoom level
let highlight; // Placeholder for map feature highlight object
let objectId; // Placeholder for selected feature OBJECTID
let clickedGraphic = null; // Reference to the last clicked graphic on the map
let currentHighlight = null; // Reference to the current highlight graphic
let tileLayer; // Variable to hold the dynamically loaded TileLayer

// ====================================================================
// 2. ARCGIS VIEW READY HANDLER
// (Initialization and Event Listeners that require a loaded view)
// ====================================================================

viewElement.addEventListener("arcgisViewReadyChange", () => {
    // === Debounce Function and Map Extent Watcher ===
    
    // Watch map extent changes (pan/zoom) to update the map list dynamically
    viewElement.view.watch("extent", (extent) => {
        debounceQuery(extent);
    });

    // A simple debounce function to limit how often a query is called during pan/zoom
    let timeout;
    function debounceQuery(extent) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            queryCount(extent); // Queries historic maps in the current extent
            queryPoints(searchBar.value.trim()); // Re-query points based on extent/search
        }, 500); // Wait 500ms after the user stops panning/zooming
    }
    
    // === Points Layer Renderer Definition ===
    
    // Define size visual variable for points (makes them smaller when zoomed out)
    const sizeVV = {
        type: "size",
        valueExpression: "$view.scale",
        stops: [
            { size: 12, value: 70 },
            { size: 9, value: 564 },
            { size: 5, value: 4513 },
            { size: 4, value: 36111 },
            { size: 2, value: 144447},
            { size: 1, value: 4622324},
        ],
    };
    
    // Simple point renderer with visual size variable
    const points = {
        type: "simple",
        visualVariables: [sizeVV],
        symbol: {
            type: "simple-marker",
            style: "circle",
            color: "#660000",
            size: 7.0,
            angle: 0.0,
            xoffset: 0,
            yoffset: 0,
            outline: {
                color: "#bfa87c",
                width: 1
            }
        }
    };
    
    // === Points Layer Initialization ===
    
    // Initialize the FeatureLayer for the Sanborn 1902 points
    const pointsLayer = new FeatureLayer({
        url: "https://lyre.cofc.edu/server/rest/services/shoc/pl_sanborn1902/FeatureServer/0",
        outFields: ["prime_material", "function_prime", "place_descript", "orig_address_no", "orig_address_street", "orig_city"],
        renderer: points,
    });
    
    // Add the points layer to the map (at index 1, above the base map)
    viewElement.map.add(pointsLayer, 1);
    
    // === Event Listeners for Map/Sidebar Interaction ===
    
    // Listener for clicking a point in the sidebar list
    pointListElement.addEventListener("click", (event) => {
        const clickedItem = event.target.closest("li");
        if (!clickedItem || clickedItem.value === undefined) {
            return; // Exit if not a list item or default option
        }
        
        // Toggle 'active' class for styling
        const allListItems = pointListElement.querySelectorAll('li');
        allListItems.forEach(item => item.classList.remove('active'));
        clickedItem.classList.add('active');

        const objectId = clickedItem.value;

        // Clear previous highlight
        if (currentHighlight) {
            currentHighlight.remove();
        }

        // Query the feature to get geometry and attributes for centering/display
        pointsLayer.queryFeatures({
            where: `OBJECTID = ${objectId}`,
            outFields: ["orig_address_no", "orig_address_street", "orig_city", "prime_material", "function_prime", "place_descript", "OBJECTID"],
            returnGeometry: true
        }).then(results => {
            if (results.features.length > 0) {
                const graphicToHighlight = results.features[0];
                const attributes = graphicToHighlight.attributes;
                
                // Center the map on the selected point
                viewElement.view.goTo(graphicToHighlight.geometry);

                // Highlight the selected graphic
                viewElement.view.whenLayerView(pointsLayer).then(layerView => {
                    currentHighlight = layerView.highlight(graphicToHighlight);
                });
                
                // Populate the pointsInfo div
                const contentHTML = `
                    <h3>${attributes.orig_address_no} ${attributes.orig_address_street}</h3>
                    <b>Original Street Address:</b> ${attributes.orig_address_no} ${attributes.orig_address_street}<br>
                    <b>Municipality:</b> ${attributes.orig_city}<br>
                    <b>Primary Material:</b> ${attributes.prime_material}<br>
                    <b>Primary Function:</b> ${attributes.function_prime}<br>
                    <b>Place Description:</b> ${attributes.place_descript}<br>
                    <b>Source:</b> 1902 Sanborn
                `;
                document.getElementById('pointsInfo').innerHTML = contentHTML;
            }
        }).catch(error => {
            console.error("Error highlighting or populating feature:", error);
            document.getElementById('pointsInfo').innerHTML = "No point selected";
        });
    });

    // Listener for typing in the search bar
    searchBar.addEventListener('input', () => {
        debounceQuery(viewElement.extent);
        // Show/expand sidebar when search input starts
        featureNode.style.display = "block";
        featureNode.style.width= "25vw";
        viewElement.style.width="75vw";
        collapseIcon.style.display = "block";
        expandIcon.style.display = "none";
    });

    // Listener for clicking the search button
    searchButton.addEventListener('click', () => {
        queryCount(viewElement.extent);
        queryPoints(searchBar.value.trim());
        // Show/expand sidebar on search click
        featureNode.style.display = "block";
        featureNode.style.width= "25vw";
        viewElement.style.width="75vw";
        collapseIcon.style.display = "block";
        expandIcon.style.display = "none";
    });
    
    // Listener for map click (hitTest for points)
    viewElement.view.on("click", (event) => {
        viewElement.view.hitTest(event).then(function(response) {
            if (response.results.length > 0) {
                const graphic = response.results[0].graphic;
                const prefix = graphic.attributes;
                
                // Clear the previous highlight
                if (currentHighlight) {
                    currentHighlight.remove();
                }
                
                // Highlight the clicked graphic
                viewElement.view.whenLayerView(pointsLayer).then((layerView) => {
                    currentHighlight = layerView.highlight(graphic, {
                        color: "red",
                        haloColor: "white",
                        haloOpacity: 0.8,
                        width: 2
                    });
                });
                
                clickedGraphic = graphic;
                
                // Populate the sidebar if a point feature was clicked
                if (prefix.orig_city !== undefined) {
                    const contentHTML = `
                        <h3>${prefix.orig_address_no} ${prefix.orig_address_street}</h3>
                        <b>Original Street Address:</b> ${prefix.orig_address_no} ${prefix.orig_address_street}<br>
                        <b>Municipality:</b> ${prefix.orig_city}<br>
                        <b>Primary Material:</b> ${prefix.prime_material}<br>
                        <b>Primary Function:</b> ${prefix.function_prime}<br>
                        <b>Place Description:</b> ${prefix.place_descript}<br>
                        <b>Source:</b> 1902 Sanborn
                    `;
                    pointsInfo.innerHTML = contentHTML;
                    
                    // Show/expand sidebar
                    featureNode.style.display = "block";
                    featureNode.style.width= "25vw";
                    viewElement.style.width="75vw";
                    collapseIcon.style.display = "block";
                    expandIcon.style.display = "none";
                    
                    // Switch to the 'Places' tab
                    $('#pointsCounter').tab('show');
                    
                } else {
                    pointsInfo.innerHTML = "No points selected";
                    clickedGraphic = null;
                }
            } else {
                // Clear highlight if map is clicked outside a feature
                if (currentHighlight) {
                    currentHighlight.remove();
                }
                pointsInfo.innerHTML = "No points selected";
            }
        });
    });

    // Listener for Points Layer visibility switch
    pointsSwitch.addEventListener("calciteSwitchChange", () => {
        pointsLayer.visible = pointsSwitch.checked;
    });

    // Listener for Points Filter (Brick/Wood/Everything)
    pointsFilterMenu.addEventListener("change", (event) => {
        const selectedValue = event.target.id;
        
        // Update active button styling
        const buttons = pointsFilterMenu.querySelectorAll('label');
        buttons.forEach(button => {
            button.classList.remove('active');
        });

        // Add the 'active' class to the parent label of the clicked input
        event.target.closest('label').classList.add('active');
        
        let pointsFilterExpression = "";

        // Determine the new definition expression for the points layer
        switch (selectedValue) {
            case "brick":
                pointsFilterExpression = "prime_material = 'brick'";
                break;
            case "wood":
                pointsFilterExpression = "prime_material = 'wood frame'";
                break;
            case "both":
            default:
                pointsFilterExpression = "1=1"; // Show all points
                break;
        }
        
        // Apply the filter to the layer
        if (pointsLayer) {
            pointsLayer.definitionExpression = pointsFilterExpression;
        }
    });

    // Listener for Sidebar Expand/Collapse button
    expandCollapse.addEventListener('click', () => {
        // Toggle sidebar visibility and map width
        if (featureNode.style.display === "block") {
            // Collapse it
            featureNode.style.display = "none";
            viewElement.style.width = "100vw";
            collapseIcon.style.display = "none";
            expandIcon.style.display = "block";
        } else {
            // Expand it
            featureNode.style.display = "block";
            viewElement.style.width = "75vw";
            collapseIcon.style.display = "block";
            expandIcon.style.display = "none";
        }
    });
});

// ====================================================================
// 3. STANDALONE FUNCTIONS AND LISTENERS
// (Map Query, Opacity, Date Sliders)
// ====================================================================

// Define the FeatureLayer for historic map index (static layer)
const parcelLayer = new FeatureLayer({
    url: "https://portal1-geo.sabu.mtu.edu/server/rest/services/Hosted/map_index/FeatureServer/0",
});

// Function to query historic map features based on extent, year range, and search text
function queryCount(extent) {
    // Reset the map results list
    resultsList.innerHTML = `<li
    id="defaultOption"
    value="1=0" class="list-group-item"><h3>No Map</h3></li>`;

    const minYear = dateSlider_l.value;
    const maxYear = dateSlider_r.value;
    let mapYearFilter = `CAST(mapyear AS INTEGER) >= ${minYear} AND CAST(mapyear AS INTEGER) <= ${maxYear}`;

    const searchText = searchBar.value.trim();
    let searchStrings = [];

    // Add search text filter if available
    if (searchText) {
        searchStrings.push(`(
            Upper(title) LIKE '%${searchText.toUpperCase()}%' OR
            Upper(source_description) LIKE '%${searchText.toUpperCase()}%' OR
            mapyear LIKE '%${searchText}%' OR
            Upper(publisher) LIKE '%${searchText.toUpperCase()}%' OR
            Upper(author) LIKE '%${searchText.toUpperCase()}%' OR
            Upper(cartographer_surveyor) LIKE '%${searchText.toUpperCase()}%' OR
            Upper(orig_repository) LIKE '%${searchText.toUpperCase()}%'
        )`);
        
        // Combine year filter with text filter
        mapYearFilter = `${mapYearFilter} AND ${searchStrings}`;
    }

    const parcelQuery = {
        where: mapYearFilter,
        spatialRelationship: "intersects",
        geometry: extent,
        outFields: ["title", "mapyear", "service_url", "source_description", "mapday", "mapmonth", "publisher", "author", "cartographer_surveyor", "orig_repository"],
        returnGeometry: true,
    };

    parcelLayer
        .queryFeatures(parcelQuery)
        .then((results) => {
            // 1. Extract and sort features by mapyear
            const sortedFeatures = results.features
            .filter((feature) => feature.attributes.mapyear)
            .sort((a, b) => a.attributes.mapyear - b.attributes.mapyear);
            
            mapsCounter.innerHTML = `Maps (${sortedFeatures.length})`; // Update map count in tab

            // 2. Track seen years to avoid duplicate map entries
            const seenYears = new Set();

            // 3. Create and append sorted options to the results list
            sortedFeatures.forEach((feature) => {
                const year = feature.attributes.mapyear;
                const title = feature.attributes.title;
                const service_url = feature.attributes.service_url;

                if (seenYears.has(year)) return;
                seenYears.add(year);

                const option = document.createElement("li");
                option.innerHTML = `${year} ${title}`;
                
                // Value is the SQL condition for the specific service URL
                option.setAttribute("value", `service_url = '${service_url}'`);
                option.setAttribute("class", `list-group-item`);
                resultsList.appendChild(option);
            });
        });
};

// Function to query point features based on search bar text
function queryPoints(searchText) {
    const pointListElement = document.getElementById("point-list");
    
    // If search text is empty, reset the list
    if (!searchText) {
        pointListElement.innerHTML = `<li id="defaultPointOption" value="undefined" class="list-group-item">Use the search bar or date range slider.</li>`;
        pointsCounter.innerHTML = `Places`;
        return; 
    }
    
    pointListElement.innerHTML = ''; // Clear the list

    let whereClause = "1=1"; // Default WHERE clause
    
    // Create a case-insensitive search across multiple fields
    if (searchText) {
        whereClause = `(
            UPPER(orig_address_no) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(orig_address_street) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(prime_material) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(function_prime) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(place_descript) LIKE '%${searchText.toUpperCase()}%'
        )`;
    }
    
    // Query points to populate the list
    viewElement.map.layers.find(layer => layer.url.includes("pl_sanborn1902")).queryFeatures({
        where: whereClause,
        outFields: ["orig_address_no", "orig_address_street", "place_descript", "OBJECTID"],
        returnGeometry: false
    }).then(results => {
        // Sort features alphabetically by address
        const sortedFeatures = results.features.sort((a, b) => {
            const addressA = `${a.attributes.orig_address_no} ${a.attributes.orig_address_street}`;
            const addressB = `${b.attributes.orig_address_no} ${b.attributes.orig_address_street}`;
            return addressA.localeCompare(addressB);
        });
        
        pointsCounter.innerHTML = `Places (${sortedFeatures.length})`; // Update places count in tab

        if (sortedFeatures.length === 0) {
            const noResultsItem = document.createElement("li");
            noResultsItem.textContent = "No points found.";
            noResultsItem.className = "list-group-item";
            pointListElement.appendChild(noResultsItem);
        } else {
            // Append results to the list
            sortedFeatures.forEach(feature => {
                const listItem = document.createElement("li");
                const attributes = feature.attributes;
                listItem.value = attributes.OBJECTID;
                listItem.textContent = `${attributes.orig_address_no} ${attributes.orig_address_street}: ${attributes.place_descript}`;
                listItem.className = "list-group-item";
                pointListElement.appendChild(listItem);
            });
        }
    }).catch(error => {
        console.error("Error querying points:", error);
    });
}

// Listener for clicking a map in the results list
resultsList.addEventListener("click", (event) => {
    const clickedLi = event.target.closest('li');

    if (!clickedLi) {
        return;
    }

    // Toggle 'active' class for styling
    const allListItems = resultsList.querySelectorAll('li');
    allListItems.forEach(item => {
        item.classList.remove('active');
    });

    clickedLi.classList.add('active');

    // Update the whereClause with the selected map's service URL condition
    whereClause = clickedLi.getAttribute('value');

    // Load the selected historic map
    queryFeatureLayer(viewElement.extent);
});

// Function to query a *single* historic map feature and display it as a TileLayer
function queryFeatureLayer(extent) {
    
    // Handle the 'No Map' default option
    if (whereClause === '1=0') {
        if (tileLayer) {
            viewElement.map.remove(tileLayer);
            mapsInfo.innerHTML = "No maps selected"
        }
        viewElement.graphics.removeAll(); // Clear the map boundary graphic
        return;
    }
    
    const parcelQuery = {
        where: whereClause, // This is the service_url='...' clause
        spatialRelationship: "intersects",
        geometry: extent,
        outFields: ["title", "mapyear", "service_url", "source_description", "mapday", "mapmonth", "publisher", "author", "cartographer_surveyor", "orig_repository"],
        returnGeometry: true,
    };

    parcelLayer
        .queryFeatures(parcelQuery)
        .then((results) => {
            displayResults(results); // Pass results to the display function
        })
        .catch((error) => {
            console.log(error.error);
        });
}

// Function to handle map display and attribute presentation
function displayResults(results) {
    const service_url = results.features[0]?.attributes?.service_url;
    const mapPrefix = results.features[0]?.attributes;
    
    if (!service_url) {
        console.error("No service_url found in feature attributes.");
        return;
    }

    // Remove previous tile layer
    if (tileLayer) {
        viewElement.map.remove(tileLayer);
        mapsInfo.innerHTML = "No maps selected"
    }
    
    // Remove the points layer temporarily for correct Z-ordering
    const existingPointsLayer = viewElement.map.layers.find(layer => layer.url && layer.url.includes("pl_sanborn1902"));
    if (existingPointsLayer) {
        viewElement.map.remove(existingPointsLayer);
    }

    // Create the new TileLayer with current opacity setting
    const initialOpacity = parseFloat(opacityInput.value) / 100;
    tileLayer = new TileLayer({
        url: service_url,
        opacity: initialOpacity,
    });

    // Add the tile layer at index 0 (bottom)
    viewElement.map.add(tileLayer, 0);
    
    // Show/expand the sidebar and display map info
    featureNode.style.display = "block";
    featureNode.style.width= "25vw";
    viewElement.style.width="75vw";
    mapsInfo.innerHTML = `<h3>${mapPrefix.mapyear} ${mapPrefix.title}</h3>
        <b>Title:</b> ${mapPrefix.title}<br>
        <b>Date:</b> ${mapPrefix.mapmonth}/${mapPrefix.mapday}/${mapPrefix.mapyear}<br>
        <b>Description:</b> ${mapPrefix.source_description}<br>
        <b>Publisher:</b> ${mapPrefix.publisher}<br>
        <b>Author:</b> ${mapPrefix.author}<br>
        <b>Cartographer/Surveyor:</b> ${mapPrefix.cartographer_surveyor}<br>
        <b>Original Repository:</b> ${mapPrefix.orig_repository}<br>
        <a href=${mapPrefix.service_url}>View Service URL</a>`;

    // Re-add the points layer on top of the tile layer (at index 1)
    const newPointsLayer = new FeatureLayer({
        url: "https://lyre.cofc.edu/server/rest/services/shoc/pl_sanborn1902/FeatureServer/0",
        outFields: ["prime_material", "function_prime", "place_descript", "orig_address_no", "orig_address_street", "orig_city"],
        renderer: points, // Reusing the defined renderer
        id: "pointsLayer" // Give the layer an ID for easy referencing
    });
    viewElement.map.add(newPointsLayer, 1);
    
    // Define the symbol for the map extent boundary graphic
    const symbol = {
        type: "simple-fill",
        color: [20, 130, 200, 0], // Transparent fill
        outline: {
            color: [20, 130, 200, 0], // Transparent outline
            width: 0.5,
        },
    };

    // Apply the symbol to the feature and add to map graphics
    results.features.map((feature) => {
        feature.symbol = symbol;
        return feature;
    });

    viewElement.closePopup();
    viewElement.graphics.removeAll(); // Clear previous map boundary
    viewElement.graphics.addMany(results.features); // Add the new map boundary graphic
}

// Listener for Opacity Slider input
opacityInput.addEventListener('input', function() {
    if (this.value >= 0) {
        rangeOutput.innerHTML = this.value + "%";
        // Update the visible tile layer's opacity if it exists
        if (tileLayer) {
            tileLayer.opacity = parseFloat(this.value) / 100;
        }
    }
});

let sliderTimeout;

// Function to handle dual date range slider updates and debounce map query
function updateSliders() {
    let minVal = parseInt(dateSlider_l.value);
    let maxVal = parseInt(dateSlider_r.value);

    // Logic to prevent min from exceeding max and vice-versa
    if (minVal > maxVal) {
        const temp = minVal;
        minVal = maxVal;
        maxVal = temp;
    }

    // Update the slider positions (useful for the swap logic above)
    dateSlider_l.value = minVal;
    dateSlider_r.value = maxVal;

    // Update the displayed min/max year values
    dateMinValue.textContent = minVal;
    dateMaxValue.textContent = maxVal;

    // Debounce the map query to avoid excessive calls while sliding
    clearTimeout(sliderTimeout);
    sliderTimeout = setTimeout(() => {
        queryCount(viewElement.extent); // Re-query maps with new date range
    }, 300); // 300ms delay for debouncing
}

// Listeners for both date slider handles
dateSlider_l.addEventListener('input', updateSliders);
dateSlider_r.addEventListener('input', updateSliders);

updateSliders(); // Initial call to set the display values and run the first query
