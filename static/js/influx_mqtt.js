import { ChartManager } from './services/chart.js';
console.log("Influx MQTT script loaded");

document.addEventListener("DOMContentLoaded", () => {
    const activeMeasurements = new Set(); // Store active measurements
    const section_id = "influx-mqtt";
    const socket = io();
    let mqttEnabled = false; 

    // DOM Elements
    const runQueryButton = document.getElementById("run-query");
    const queryList = document.getElementById("query-list");
    

    // Chart Manager initialization
    const chartManager = new ChartManager("chart-container");


    // Fetch saved queries from server
    async function fetchSavedQueries() {
        try {
            const response = await fetch("/api/user_queries", { 
                method: "GET", 
                headers: { "Content-Type": "application/json" } 
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            data.queries ? populateSavedQueries(data.queries) : console.error("No queries found.");
        } catch (error) {
            console.error("Error fetching saved queries:", error);
        }
    }

    // Populate saved queries in the list
    function populateSavedQueries(queries) {
        queryList.innerHTML = ""; // Clear list
        queries.length
            ? queries.forEach(query => createQueryListItem(query))
            : (queryList.innerHTML = "<li>No saved queries found</li>");
    }

    function createQueryListItem(query) {
        const listItem = document.createElement("li");
        listItem.textContent = query.query_name;
        listItem.dataset.value = query.query_name;
        listItem.dataset.measurements = JSON.stringify(query.query_structure?.measurements || []);

        listItem.addEventListener("click", () => {
            queryList.querySelectorAll("li").forEach(item => item.classList.remove("selected"));
            listItem.classList.add("selected");
        });

        queryList.appendChild(listItem);
    }

    // Run Query (Fetch Historical Data)
    runQueryButton.addEventListener("click", async () => {
        activeMeasurements.clear();
        const selectedOption = queryList.querySelector("li.selected");
        if (!selectedOption) return alert("Please select a query to run.");

        const queryName = selectedOption.dataset.value;
        chartManager.reset();
        
        try {
            const response = await fetch(`/api/realtime/${queryName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timeRange: null, aggregation: null, section_id })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            // Process historical data from response
            const data = await response.json();
            processHistoricalData(data);

            // After processing, enable MQTT streaming
            mqttEnabled = true;
        } catch (error) {
            handleError("Error running query", error);
        }
    });

    // Process Historical Data
    function processHistoricalData(dataArray) {
        console.log("[real time influx mqtt.js] Processing data:", dataArray);

        dataArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        dataArray.forEach(data => {
            if (!data.measurement) return;
            
            activeMeasurements.add(data.measurement);
            const dataPoint = {
                x: new Date(data.timestamp),
                y: data.value
            };
            chartManager.updateOrCreateChart(data.measurement, dataPoint);
        });
    }

    // Modified Socket Handler
    socket.on("mqtt_data", (payload) => {
        if (!mqttEnabled) return;
        
        payload.data.forEach(item => {
            if (activeMeasurements.has(item.topic)) {
                // Extract the timestamp
                const timestamp = item.fields.timestamp;
                console.log("MQTT Timestamp (raw):", item.fields.timestamp); // e.g., "2025-02-24T15:37:24Z"
                // const utcTimestamp = new Date(item.fields.timestamp).getTime();
                // console.log("MQTT Timestamp (converted):", utcTimestamp); // Correct UTC milliseconds
                
            // Extract the second dynamic field (excluding 'timestamp')
            let value;
            for (let key in item.fields) {
                if (key !== 'timestamp') {
                    value = item.fields[key];
                    break; // Stop after finding the first non-timestamp field
                }
            }
            
            const dataPoint = {
                x: timestamp,
                y: value
            };
            
            chartManager.updateOrCreateChart(item.topic, dataPoint);
            console.log(`Chart updated data ${item.topic}`, dataPoint);
            }
        });
    });

    fetchSavedQueries();
});
