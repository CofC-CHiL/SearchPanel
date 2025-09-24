const opacityInput = document.getElementById('sliderDiv');
  const rangeOutput = document.getElementById('rangeValue');

			const FeatureLayer = await $arcgis.import("@arcgis/core/layers/FeatureLayer.js");
            const TileLayer = await $arcgis.import("@arcgis/core/layers/TileLayer.js");   
			const viewElement = document.querySelector("arcgis-map");
			const selectFilter = document.querySelector("#sqlSelect");
			const defaultOption = document.querySelector("#defaultOption");
			const defaultPointOption = document.querySelector("#defaultPointOption");
			const pointsFilterMenu = document.querySelector("#pointsFilter");
			const pointsSwitch = document.querySelector("calcite-switch");
			const defaultFilter = document.querySelector("#defaultFilter");
			let whereClause = defaultOption.value;
			let wherePointClause = defaultPointOption.value;
			const zoom = viewElement.zoom;
			const featureNode = document.querySelector("#feature-node");
			const expandCollapse = document.querySelector("#expandCollapse");
			let highlight;
          	let objectId;
          	const collapseIcon = document.getElementById('collapse-icon');
    		const expandIcon = document.getElementById('expand-icon');
    		let clickedGraphic = null;
			let currentHighlight = null;
			const dateSlider_l = document.getElementById('dateSlider_l');
            const dateSlider_r = document.getElementById('dateSlider_r');
            const dateMinValue = document.getElementById('dateMinValue');
            const dateMaxValue = document.getElementById('dateMaxValue');
			const resultsList = document.querySelector("#result-list");
			const pointsList = document.querySelector("#point-list");
			const mapsInfo = document.getElementById('mapsInfo');
			const searchBar = document.querySelector("#searchBar");
			const searchButton = document.querySelector("#searchButton");
			const pointListElement = document.getElementById("point-list");
			
			viewElement.addEventListener("arcgisViewReadyChange", () => {
    // All layer, popup, and event listener declarations should go here
viewElement.view.watch("extent", (extent) => {
    debounceQuery(extent);
});

// A simple debounce function to limit how often a function is called
let timeout;
function debounceQuery(extent) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        queryCount(extent);
        queryPoints(searchBar.value.trim());
    }, 500); // Wait 500ms after the user stops panning/zooming
}
    // Define popup for points layer
    const popupPoints = {
        title: "{orig_address_no} {orig_address_street}",
        content:
            "Original Street Address: {orig_address_no} {orig_address_street}<br>Municipality: {orig_city}<br>Primary Material: {prime_material}<br>Primary Function: {function_prime}<br>Place Description: {place_descript}<br>Source: 1902 Sanborn",
    };
    
    const points = {
    type: "unique-value",
    field: "prime_material",
    uniqueValueInfos: [{
        value: "wood frame",
        symbol: {
            type: "simple-marker", // Added type
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
    },
        {
        value: "brick", 
        symbol: {
            type: "simple-marker",
            style: "circle",
            color: "#bfa87c",
            size: 7.0,
            angle: 0.0,
            xoffset: 0,
            yoffset: 0,
            outline: {
                color: "#660000",
                width: 1
            }
        }
    }]
};
    
//const points = {
    //type: "unique-value",
    //field: "Is_NHL",
    //field2: "STATUS",
    //fieldDelimiter: ",",
    //uniqueValueInfos: [{
        //value: "X,Listed",
        //symbol: {
            //type: "simple-marker", // Added type
            //style: "circle",
            //color: [0, 112, 255, 255],
            //size: 10.0,
            //angle: 0.0,
            //xoffset: 0,
            //yoffset: 0,
            //outline: { // Corrected outline object
                //color: [0, 112, 255, 255],
                //width: 1
            //}
        //}
    //},
    //{
        //value: "<Null>,Listed",
        //symbol: {
            //type: "simple-marker", // Added type
            //style: "circle",
            //color: [255, 170, 0, 255],
            //size: 10.0,
            //angle: 0.0,
            //xoffset: 0,
            //yoffset: 0,
            //outline: { // Corrected outline object
                //color: [255, 170, 0, 255],
                //width: 1
            //}
        //}
    //},
    //{
        //value: "<Null>,Removed", // Added a new unique value for "Removed"
        //symbol: {
            //type: "simple-marker",
            //style: "circle",
            //color: "gray",
            //angle: 0.0,
            //xoffset: 0,
            //yoffset: 0,
            //outline: {
                //color: "gray",
                //width: 1
            //}
        //}
    //}]
//};
    
    // Define points layer
    //const pointsLayer = new FeatureLayer({
        //url: "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0",
        //outFields: ["RESNAME", "Address", "City", "NARA_URL", "Is_NHL", "STATUS"],
        //popupTemplate: popupPoints,
        //renderer: points,
    //});
    
    const pointsLayer = new FeatureLayer({
        url: "https://lyre.cofc.edu/server/rest/services/shoc/pl_sanborn1902/FeatureServer/0",
        outFields: ["prime_material", "function_prime", "place_descript", "orig_address_no", "orig_address_street", "orig_city"],
        //popupTemplate: popupPoints,
        renderer: points,
    });
    
    viewElement.map.add(pointsLayer, 1);
    function queryPoints(searchText) {
       const pointListElement = document.getElementById("point-list");
    pointListElement.innerHTML = ''; // Clear the list

    // Start with a default WHERE clause that selects all features
    let whereClause = "1=1"; 

    // If there is search text, create a WHERE clause for the query
    if (searchText) {
        // Use UPPER() and LIKE to create a case-insensitive search across multiple fields
        whereClause = `(
            UPPER(orig_address_no) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(orig_address_street) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(prime_material) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(function_prime) LIKE '%${searchText.toUpperCase()}%' OR
            UPPER(place_descript) LIKE '%${searchText.toUpperCase()}%'
        )`;
    }
    
    // Query all points to populate the dropdown
 pointsLayer.queryFeatures({
        where: whereClause,
        outFields: ["orig_address_no", "orig_address_street", "OBJECTID"],
        returnGeometry: false
    }).then(results => {
        const sortedFeatures = results.features.sort((a, b) => {
            const addressA = `${a.attributes.orig_address_no} ${a.attributes.orig_address_street}`;
            const addressB = `${b.attributes.orig_address_no} ${b.attributes.orig_address_street}`;
            return addressA.localeCompare(addressB);
        });

        if (sortedFeatures.length === 0) {
            const noResultsItem = document.createElement("li");
            noResultsItem.textContent = "No points found.";
            noResultsItem.className = "list-group-item";
            pointListElement.appendChild(noResultsItem);
        } else {
            sortedFeatures.forEach(feature => {
                const listItem = document.createElement("li");
                const attributes = feature.attributes;
                listItem.value = attributes.OBJECTID;
                listItem.textContent = `${attributes.orig_address_no} ${attributes.orig_address_street}`;
                listItem.className = "list-group-item";
                pointListElement.appendChild(listItem);
            });
        }
    }).catch(error => {
        console.error("Error querying points:", error);
    });
}
    // All event listeners are now consolidated in one place
pointListElement.addEventListener("click", (event) => {
    const clickedItem = event.target.closest("li");
    if (!clickedItem || clickedItem.value === undefined) {
        return; // Exit if a non-list-item or default option is clicked
    }
    
    // Remove the 'active' class from all other items
    const allListItems = pointListElement.querySelectorAll('li');
    allListItems.forEach(item => item.classList.remove('active'));
    
    // Add 'active' class to the clicked item
    clickedItem.classList.add('active');

    const objectId = clickedItem.value;

    // Clear the previous highlight
    if (currentHighlight) {
        currentHighlight.remove();
    }

    // Find and highlight the point on the map
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
            
            // Populate the pointsInfo div with the selected point's attributes
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

    // Search functionality
searchBar.addEventListener('input', () => {
    debounceQuery(viewElement.extent);
    featureNode.style.display = "block";
        featureNode.style.width= "25vw";
        viewElement.style.width="75vw";
        collapseIcon.style.display = "block";
        expandIcon.style.display = "none";
        
});
searchButton.addEventListener('click', () => {
    queryCount(viewElement.extent);
    queryPoints(searchBar.value.trim());
    featureNode.style.display = "block";
        featureNode.style.width= "25vw";
        viewElement.style.width="75vw";
        collapseIcon.style.display = "block";
        expandIcon.style.display = "none";
});
queryPoints(searchBar.value.trim());
    // Add an event listener for the 'input' event
//searchBar.addEventListener('input', (event) => {
  // Access the current value of the input field
  //const inputValue = event.target.value;
  //console.log('Input value changed:', inputValue);

//});
    
viewElement.view.on("click", (event) => {
        viewElement.view.hitTest(event).then(function(response) {
    	if (response.results.length > 0) {
    const graphic = response.results[0].graphic;
    const prefix = graphic.attributes;
    // Clear the previous highlight
            if (currentHighlight) {
                currentHighlight.remove();
            }
            
 viewElement.view.whenLayerView(pointsLayer).then((layerView) => {
                currentHighlight = layerView.highlight(graphic, {
                    color: "red",
                    haloColor: "white",
                    haloOpacity: 0.8,
                    width: 2
                });
            });
             // Set the clicked graphic
            clickedGraphic = graphic;
    // Check if the prefix object is defined before trying to access its properties
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
        featureNode.style.display = "block";
        featureNode.style.width= "25vw";
        viewElement.style.width="75vw";
        collapseIcon.style.display = "block";
        expandIcon.style.display = "none";
        
        
    } else {
        pointsInfo.innerHTML = "No points selected";
        clickedGraphic = null;
        //featureNode.style.display = "none";
        //viewElement.style.width="100vw";
    }
} else {
if (currentHighlight) {
                currentHighlight.remove();
            }
    pointsInfo.innerHTML = "No points selected";
    //featureNode.style.display = "none";
    //viewElement.style.width="100vw";
}
    });
});

    
    
    pointsSwitch.addEventListener("calciteSwitchChange", () => {
        pointsLayer.visible = pointsSwitch.checked;
    });
pointsFilterMenu.addEventListener("change", (event) => {
    // Get the ID of the checked radio button, which corresponds to the filter value
    const selectedValue = event.target.id;
    console.log("Selected value: " + selectedValue);
    
     // Update active button styling
        const buttons = pointsFilterMenu.querySelectorAll('label');
        buttons.forEach(button => {
            button.classList.remove('active');
        });

// Add the 'active' class to the parent label of the clicked input
        event.target.closest('label').classList.add('active');
        
    let pointsFilterExpression = "";

    switch (selectedValue) {
        case "brick":
            pointsFilterExpression = "prime_material = 'brick'";
            break;
        case "wood":
            pointsFilterExpression = "prime_material = 'wood frame'";
            break;
        case "both":
        default:
            pointsFilterExpression = "1=1";
            break;
    }
    
    // Check if pointsLayer is defined before applying the filter
    if (pointsLayer) {
        pointsLayer.definitionExpression = pointsFilterExpression;
    }
});

expandCollapse.addEventListener('click', () => {

    // Check if the featureNode is currently visible
    if (featureNode.style.display === "block") {
        // If it's visible, collapse it
        featureNode.style.display = "none";
        viewElement.style.width = "100vw";
        collapseIcon.style.display = "none";
        expandIcon.style.display = "block";
    } else {
        // If it's hidden, expand it
        featureNode.style.display = "block";
        viewElement.style.width = "75vw";
        collapseIcon.style.display = "block";
        expandIcon.style.display = "none";
    }
});
});

//  dynamically populate historic map dropdown
function queryCount(extent) {
    //selectFilter.innerHTML = '<calcite-option id="defaultOption" value="1=0" label="Choose a historic map"></calcite-option>';
	resultsList.innerHTML = `<li
	id="defaultOption"
	value="1=0" class="list-group-item"><h3>No Map</h3></li>`;
    const minYear = dateSlider_l.value;
    const maxYear = dateSlider_r.value;
    console.log(`Filtering maps from ${minYear} to ${maxYear}`);
    let mapYearFilter = `CAST(mapyear AS INTEGER) >= ${minYear} AND CAST(mapyear AS INTEGER) <= ${maxYear}`;

const searchText = searchBar.value.trim();
let searchStrings = [];

if (searchText) {
    // Define an array of fields to search
    //const searchFields = ["title", "mapyear", "source_description", "publisher", "author", "cartographer_surveyor", "orig_repository"];
    
    // Escape the search term to prevent SQL injection and syntax errors
    //const escapedSearchText = searchText.replace(/'/g, "''");
    searchStrings.push("(Upper(title) LIKE '%" + searchText.toUpperCase() + 
      "%' OR Upper(source_description) LIKE '%" + searchText.toUpperCase() + 
      "%' OR mapyear LIKE '%" + searchText +
      "%' OR Upper(publisher) LIKE '%" + searchText.toUpperCase()+ 
      "%' OR Upper(author) LIKE '%" + searchText.toUpperCase()+ 
      "%' OR Upper(cartographer_surveyor) LIKE '%" + searchText.toUpperCase()+ 
      "%' OR Upper(orig_repository) LIKE '%" + searchText.toUpperCase() + "%')");
      
    // Build the text filter part of the query dynamically
    //const textFilters = searchFields.map(field => `${field} LIKE '%${escapedSearchText}%'`);
    //const combinedTextFilter = `(${textFilters.join(' OR ')})`;
    // Correctly combine the year filter with the new text filter
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
							console.log("Feature count: " + results.features.length);

							// 1. Extract and sort features by mapyear
							const sortedFeatures = results.features
							.filter((feature) => feature.attributes.mapyear) // Ensure mapyear exists
							.sort((a, b) => a.attributes.mapyear - b.attributes.mapyear);

							// 2. Track seen years to avoid duplicates
							const seenYears = new Set();

							// 3. Create and append sorted options
							sortedFeatures.forEach((feature) => {
							const year = feature.attributes.mapyear;
							const title = feature.attributes.title;
							const service_url = feature.attributes.service_url;

							if (seenYears.has(year)) return;
							seenYears.add(year);

							//const option = document.createElement("calcite-option");
							const option = document.createElement("li");
						option.innerHTML = `<h3>${year} ${title}</h3>
						${feature.attributes.source_description}. Published by ${feature.attributes.publisher} in ${year}. Author ${feature.attributes.author} and cartographer ${feature.attributes.cartographer_surveyor}. Courtesy of ${feature.attributes.orig_repository}.
						<!--<br>
        <b>Publisher:</b> ${feature.attributes.publisher}<br>
        <b>Author:</b> ${feature.attributes.author}<br>
        <b>Cartographer/Surveyor:</b> ${feature.attributes.cartographer_surveyor}<br>
        <b>Original Repository:</b> ${feature.attributes.orig_repository}-->`;
            				
							option.setAttribute("value", `service_url = '${service_url}'`);
							option.setAttribute("class", `list-group-item`);
							//selectFilter.appendChild(option);
							resultsList.appendChild(option);
							});



				});
			};
   
                
                
				//pulls up historic map
				// Event listener - after dropdown option selected
				//selectFilter.addEventListener("calciteSelectChange", (event) => {
					//whereClause = event.target.value;

					//queryFeatureLayer(viewElement.extent);

				//});
				
				//selectFilter.addEventListener("click", (event) => {
resultsList.addEventListener("click", (event) => {
    // Get the clicked list item. The 'closest' method ensures you get the <li> even if a child element is clicked.
    const clickedLi = event.target.closest('li');

    // Ensure a valid list item was clicked
    if (!clickedLi) {
        return;
    }

    // First, remove the 'active' class from all other list items in the ul
    const allListItems = resultsList.querySelectorAll('li');
    allListItems.forEach(item => {
        item.classList.remove('active');
    });

    // Then, add the 'active' class to the clicked list item
    clickedLi.classList.add('active');

    // Retrieve the value attribute to set the whereClause
    whereClause = clickedLi.getAttribute('value');

    // Call the query function with the updated whereClause
    queryFeatureLayer(viewElement.extent);
});
				// Get query layer and set up query
				const parcelLayer = new FeatureLayer({
					url: "https://portal1-geo.sabu.mtu.edu/server/rest/services/Hosted/map_index/FeatureServer/0",
				});

				function queryFeatureLayer(extent) {
				
				// If the default option is selected, remove the tile layer and exit
    if (whereClause === '1=0') {
        if (tileLayer) {
            viewElement.map.remove(tileLayer);
            mapsInfo.innerHTML = "No maps selected"
        }
        // This line is crucial to ensure the historic map is not loaded
        viewElement.graphics.removeAll();
        return;
    }
				
    const parcelQuery = {
        where: whereClause,
        spatialRelationship: "intersects",
        geometry: extent,
        outFields: ["title", "mapyear", "service_url", "source_description", "mapday", "mapmonth", "publisher", "author", "cartographer_surveyor", "orig_repository"],
        returnGeometry: true,
    };

    parcelLayer
        .queryFeatures(parcelQuery)
        .then((results) => {
            console.log("Feature count: " + results.features.length);
            displayResults(results);
        })
        .catch((error) => {
            console.log(error.error);
        });
}

let tileLayer;

function displayResults(results) {
    const service_url = results.features[0]?.attributes?.service_url;
    const mapPrefix = results.features[0]?.attributes;
    

    if (!service_url) {
        console.error("No service_url found in feature attributes.");
        return;
    }

    // Remove previous tile layer if it exists
    if (tileLayer) {
        viewElement.map.remove(tileLayer);
        mapsInfo.innerHTML = "No maps selected"
    }
    
    // Remove the points layer before adding the new tile layer, so we can re-add it on top
    const existingPointsLayer = viewElement.map.layers.find(layer => layer.id === "pointsLayer");
    if (existingPointsLayer) {
        viewElement.map.remove(existingPointsLayer);
    }

    const initialOpacity = parseFloat(opacityInput.value) / 100;

    tileLayer = new TileLayer({
        url: service_url,
        opacity: initialOpacity,
    });

    // Add the tile layer first, at the bottom of the stack
    viewElement.map.add(tileLayer, 0);
    
    
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

    // Re-add the points layer on top of the tile layer
    const pointsLayer = new FeatureLayer({
        url: "https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0",
        outFields: ["RESNAME", "Address", "City", "NARA_URL", "Is_NHL", "STATUS"],
        //popupTemplate: popupPoints,
        renderer: points,
        id: "pointsLayer" // Give the layer an ID for easy referencing
    });
    viewElement.map.add(pointsLayer, 1);

    const symbol = {
        type: "simple-fill",
        color: [20, 130, 200, 0],
        outline: {
            color: [20, 130, 200, 0],
            width: 0.5,
        },
    };

    const popupTemplate = {
        title: "{mapyear} {title}",
        content:
            "Title: {title}<br>Date: {mapmonth}/{mapday}/{mapyear}<br>Description: {source_description}<br>Publisher: {publisher}<br>Author: {author}<br>Cartographer/Surveyor: {cartographer_surveyor}<br>Original Repository: {orig_repository}<br><a href={service_url}>View Service URL</a>",
    };

    results.features.map((feature) => {
        feature.symbol = symbol;
        //feature.popupTemplate = popupTemplate;
        return feature;
    });

    viewElement.closePopup();
    viewElement.graphics.removeAll();
    viewElement.graphics.addMany(results.features);
}
opacityInput.addEventListener('input', function() {
    if (this.value > 0) {
        console.log("Range Slider has value of " + this.value);
        rangeOutput.innerHTML = this.value + "%";
        if (tileLayer) {
            tileLayer.opacity = parseFloat(this.value) / 100;
        }
    } else{
        console.log("Range Slider has value of " + this.value);
    }
});

let sliderTimeout;

function updateSliders() {
    let minVal = parseInt(dateSlider_l.value);
    let maxVal = parseInt(dateSlider_r.value);

    // Swap values if min exceeds max
    if (minVal > maxVal) {
        const temp = minVal;
        minVal = maxVal;
        maxVal = temp;
    }

    dateSlider_l.value = minVal;
    dateSlider_r.value = maxVal;

    dateMinValue.textContent = minVal;
    dateMaxValue.textContent = maxVal;

    // Clear the previous timeout to reset the debounce timer
    clearTimeout(sliderTimeout);

    // Set a new timeout to call queryCount after a brief delay
    sliderTimeout = setTimeout(() => {
        queryCount(viewElement.extent);
    }, 300); // 300ms is a good delay for a smooth feel
}

dateSlider_l.addEventListener('input', updateSliders);
dateSlider_r.addEventListener('input', updateSliders);

updateSliders(); // Initial call to set the display values
