import {ChartManager } from './services/chart.js';
console.log("Class influx script loaded");

document.addEventListener("DOMContentLoaded", () => {
    const selectedMeasurements = [];
    const section_id = 'class_query';
    const socket = io();

    // DOM Elements
    const measurementForm = document.getElementById("measurement-form");
    const measurementSelect = document.getElementById("measurements");
    const selectedList = document.getElementById("selected-list");
    const queryList = document.getElementById("query-list");
    const queryNameInput = document.getElementById("query-name");
    const addMeasurementButton = document.getElementById("add-measurement");
    const removeMeasurementButton = document.getElementById("remove-measurement");
    const saveQueryButton = document.getElementById("save-query-button");
    const runQueryButton = document.getElementById('run-query');
    const deleteQueryButton = document.getElementById('delete-query');

    // Chart Manager initialization
    const chartManager = new ChartManager("chart-container");
    

    // Fetch data on page load
    measurementForm.addEventListener("submit", (event) => {
        event.preventDefault();
        submitQuery({ measurement: measurementSelect.value });
    });

    async function submitQuery(query) {
        try {
            console.log("Submitting query:", query);
            const response = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(query)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            console.log("Query result:", await response.json());
        } catch (error) { handleError("Error submitting query", error); }
    }

    // fetching measurements from the server
    async function fetchData() {
        try {
            console.log("Fetching available measurements...");
            const response = await fetch("/api/data");

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            
            populateMeasurements(data.measurements);
        } catch (error) { handleError("Error fetching data", error); }
    }

    // Populating the measurements dropdown
    function populateMeasurements(measurements) {
        measurementSelect.innerHTML = "";
        measurements.forEach(measurement => {
                if(measurement != 'user_queries'){
                    const option = document.createElement("option");
                    option.value = measurement;
                    option.textContent = capitalize(measurement);
                    measurementSelect.appendChild(option);
            }
        });
    }

    function capitalize(string) { return string.charAt(0).toUpperCase() + string.slice(1); }

    // Adding and removing measurements from the selected list to query
    addMeasurementButton.addEventListener("click", () => {
        const selectedOption = measurementSelect.value;
        if (selectedOption && !selectedMeasurements.includes(selectedOption)) {
            selectedMeasurements.push(selectedOption);
            updateSelectedList();
        }
    });

    removeMeasurementButton.addEventListener("click", () => {
        const selectedOption = selectedList.querySelector("li.selected");
        if (selectedOption) {
            selectedMeasurements.splice(selectedMeasurements.indexOf(selectedOption.dataset.value), 1);
            updateSelectedList();
        }
    });

    // Sending the selected measurements to the server for running the query
    function updateSelectedList() {
        selectedList.innerHTML = "";
        selectedMeasurements.forEach(measurement => {
            const listItem = document.createElement("li");
            listItem.textContent = measurement;
            listItem.dataset.value = measurement;
            listItem.addEventListener("click", () => listItem.classList.toggle("selected"));
            selectedList.appendChild(listItem);
        });
        runQuery();
    }

    // Saving the selected measurements as a query
    saveQueryButton.addEventListener("click", async () => {
        const queryName = queryNameInput.value.trim();
        if (!queryName) return alert("Please enter a query name.");
        try {
            const response = await fetch("/api/save_query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query_name: queryName, measurements: selectedMeasurements })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            alert("Query saved successfully!");
            queryNameInput.value = "";
            await fetchSavedQueries();
        } catch (error) { handleError("Error saving query", error); }
    });

    // Fetching saved queries from the server
    // async function fetchSavedQueries() {
    //     try {
    //         const response = await fetch('/api/user_queries', {
    //             method: 'GET',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             }
    //         });
    //         if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    //         const data = await response.json();

    //          // Check if the response contains queries
    //         if (data.queries) {
    //             populateSavedQueries(data.queries);  // Populate the list with the retrieved queries
    //         } else {
    //             console.error('No queries found in response.');
    //         }
    //     } catch (error) {
    //         console.error('Error fetching saved queries:', error);
    //     }
    // }

    // // populating the saved queries list
    // function populateSavedQueries(queries) {
    //     queryList.innerHTML = ''; // Clear existing list
    
    //     if (queries.length) {
    //         queries.forEach(query => {
    //             // Ensure query_structure.measurements exists and is an array
    //             const measurements = Array.isArray(query.query_structure?.measurements) 
    //                 ? query.query_structure.measurements 
    //                 : []; // Default to empty array if not found
    
    //             // If measurements are not empty, create the list item
    //             const listItem = document.createElement('li');
    //             listItem.textContent = query.query_name;
    //             listItem.dataset.value = query.query_name; // Store query name as data attribute
    
    //             // Add click event to select the item
    //             listItem.addEventListener("click", () => {
    //                 // Deselect all items
    //                 queryList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
    //                 // Select clicked item
    //                 listItem.classList.add('selected');
    //             });
    
    //             queryList.appendChild(listItem);
    //         });
    //     } else {
    //         queryList.innerHTML = "<li>No saved queries found</li>";
    //     }
    // }

    async function runQuery() {
        if (!selectedMeasurements.length) return;
        chartManager.reset();
        
        console.log("Sending query to /api/query with:", {
            measurements: selectedMeasurements,
            timeRange: null,
            aggregation: null,
            section_id: section_id
        });
        try {
            const response = await fetch("/api/query", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ 
                    measurements: selectedMeasurements, 
                    timeRange: null, 
                    aggregation: null, 
                    section_id: section_id 
                })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            console.log("Query started:", await response.json());
        } catch (error) { handleError("Error running query", error); }
    }

    // Event listener for running a query from saved queries
    // runQueryButton.addEventListener("click", async () => {
    //     chartManager.reset();
    //     const selectedOption = queryList.querySelector("li.selected");
    //     if (selectedOption) {
    //         const queryName = selectedOption.dataset.value;
    //         const timeRange = null;
    //         const aggregation = null
    //         console.log("Sending saved query to /api/query/" + queryName, {
    //             timeRange: timeRange,
    //             aggregation: aggregation,
    //             section_id: section_id
    //         });
    //         try {
    //             const response = await fetch(`/api/query/${queryName}`, {
    //                 method: "POST",
    //                 headers: {
    //                     "Content-Type": "application/json"  // Ensure content type is set
    //                 },
    //                 body: JSON.stringify({
    //                     timeRange: timeRange,
    //                     aggregation: aggregation,
    //                     section_id : section_id
    //                 })
    //             });
    //             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
    //         } catch (error) {
    //             handleError("Error running query", error);
    //         }
    //     } else {
    //         alert("Please select a query to run.");
    //     }
    // });

    // Event listener for deleting a query
    // deleteQueryButton.addEventListener("click", async () => {
    //     const selectedOption = queryList.querySelector("li.selected");
    //     if (selectedOption) {
    //         const queryName = selectedOption.dataset.value;
    //         try {
    //             const response = await fetch(`/api/query/${queryName}`, {
    //                 method: "DELETE"
    //             });
    //             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    //             alert("Query deleted successfully!");
    //             await fetchSavedQueries(); // Refresh the query list
    //         } catch (error) {
    //             handleError("Error deleting query", error);
    //         }
    //     } else {
    //         alert("Please select a query to delete.");
    //     }
    // });

    // Helper function to get the selected query name from the list item
    function getSelectedQuery() {
        const selectedListItem = queryList.querySelector("li.selected");
        return selectedListItem ? selectedListItem.dataset.value : null;
    }
     
    function processBatchData(dataArray) {
        dataArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        dataArray.forEach(data => {
            if (!data.measurement) return;
            chartManager.updateOrCreateChart(data.measurement, {
                 x: new Date(data.timestamp), 
                 y: data.value 
                });
        });
    }

    socket.onAny((event, args) => {
        if (event.startsWith("dataUpdate_")) {
            console.log(`Received [Class influx socket] ${event}:`, args);
            const current_section_id = event.replace("dataUpdate_", "");
            console.log("current_section_id:", current_section_id);
            
            if (current_section_id != section_id) return;

            const dataArray = Array.isArray(args) ? args : [args];
            processBatchData(dataArray);
                
        }
    });

    fetchData();
    fetchSavedQueries();
});
