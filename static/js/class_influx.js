console.log("Class influx script loaded");

document.addEventListener("DOMContentLoaded", () => {
    const selectedMeasurements = [];
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
    const chartCanvas = document.getElementById("comparisonChart");
    const runQueryButton = document.getElementById('run-query');
    const deleteQueryButton = document.getElementById('delete-query');

    // Chart initialization
    let comparisonChart = new Chart(chartCanvas, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: { scales: { x: { type: "linear", position: "bottom" }, y: { beginAtZero: true } } }
    });

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
            const response = await fetch("/api/data");
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            populateMeasurements((await response.json()).measurements);
        } catch (error) { handleError("Error fetching data", error); }
    }

    // Populating the measurements dropdown
    function populateMeasurements(measurements) {
        measurementSelect.innerHTML = "";
        measurements.forEach(measurement => {
                if(measurement != 'User_queries'){
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
    async function fetchSavedQueries() {
        try {
            const response = await fetch('/api/user_queries', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

             // Check if the response contains queries
            if (data.queries) {
                populateSavedQueries(data.queries);  // Populate the list with the retrieved queries
            } else {
                console.error('No queries found in response.');
            }
        } catch (error) {
            console.error('Error fetching saved queries:', error);
        }
    }

    // populating the saved queries list
    function populateSavedQueries(queries) {
        queryList.innerHTML = ''; // Clear existing list
    
        if (queries.length) {
            queries.forEach(query => {
                // Ensure query_structure.measurements exists and is an array
                const measurements = Array.isArray(query.query_structure?.measurements) 
                    ? query.query_structure.measurements 
                    : []; // Default to empty array if not found
    
                // If measurements are not empty, create the list item
                const listItem = document.createElement('li');
                listItem.textContent = query.query_name;
                listItem.dataset.value = query.query_name; // Store query name as data attribute
    
                // Add click event to select the item
                listItem.addEventListener("click", () => {
                    // Deselect all items
                    queryList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
                    // Select clicked item
                    listItem.classList.add('selected');
                });
    
                queryList.appendChild(listItem);
            });
        } else {
            queryList.innerHTML = "<li>No saved queries found</li>";
        }
    }

    async function runQuery() {
        if (!selectedMeasurements.length) return;
        try {
            const response = await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ measurements: selectedMeasurements, timeRange: null, aggregation: null })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            console.log("Query started:", await response.json());
        } catch (error) { handleError("Error running query", error); }
    }

    // Event listener for running a query from saved queries
    runQueryButton.addEventListener("click", async () => {
        const selectedOption = queryList.querySelector("li.selected");
        if (selectedOption) {
            const queryName = selectedOption.dataset.value;
            const timeRange = null;
            const aggregation = null
            try {
                const response = await fetch(`/api/query/${queryName}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"  // Ensure content type is set
                    },
                    body: JSON.stringify({
                        timeRange: timeRange,
                        aggregation: aggregation
                    })
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                displayQueryResults(result); // Implement this function to display the results
            } catch (error) {
                handleError("Error running query", error);
            }
        } else {
            alert("Please select a query to run.");
        }
    });

    // Event listener for deleting a query
    deleteQueryButton.addEventListener("click", async () => {
        const selectedOption = queryList.querySelector("li.selected");
        if (selectedOption) {
            const queryName = selectedOption.dataset.value;
            try {
                const response = await fetch(`/api/query/${queryName}`, {
                    method: "DELETE"
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                alert("Query deleted successfully!");
                await fetchSavedQueries(); // Refresh the query list
            } catch (error) {
                handleError("Error deleting query", error);
            }
        } else {
            alert("Please select a query to delete.");
        }
    });

    // Helper function to get the selected query name from the list item
    function getSelectedQuery() {
        const selectedListItem = queryList.querySelector("li.selected");
        return selectedListItem ? selectedListItem.dataset.value : null;
    }


    socket.on("dataUpdate", (data) => {
        if (selectedMeasurements.includes(data.measurement)) updateChart(data);
    });

    function updateChart(data) {
        comparisonChart.data.labels.push(data.timestamp);
        let dataset = comparisonChart.data.datasets.find(d => d.label === data.measurement);
        if (!dataset) {
            dataset = { label: data.measurement, data: [], borderColor: getRandomColor(), fill: false };
            comparisonChart.data.datasets.push(dataset);
        }
        dataset.data.push(data.value);
        comparisonChart.update();
    }

    function getRandomColor() {
        return `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
    }

    function handleError(message, error) {
        console.error(`${message}:`, error);
        alert(message);
    }

    fetchData();
    fetchSavedQueries();
});
