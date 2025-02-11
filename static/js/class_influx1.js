console.log("Class influx script loaded");

document.addEventListener('DOMContentLoaded', () => {
    let selectedMeasurements = [];
    const socket = io(); // WebSocket connection for real-time updates

    const measurementSelect = document.getElementById('measurements');
    const selectedList = document.getElementById('selected-list');
    const queryNameInput = document.getElementById('query-name');
    const saveQueryButton = document.getElementById('save-query-button');
    const addMeasurementButton = document.getElementById('add-measurement');
    const removeMeasurementButton = document.getElementById('remove-measurement');
    const queryList = document.getElementById('query-list');

    // Chart.js setup
    let comparisonChart = new Chart(document.getElementById('comparisonChart'), {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: { scales: { x: { type: 'linear' }, y: { beginAtZero: true } } }
    });

    // Fetch measurements from InfluxDB
    async function fetchMeasurements() {
        try {
            const response = await fetch('/api/data');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            populateMeasurementDropdown(data.measurements);
        } catch (error) {
            console.error('Error fetching measurements:', error);
        }
    }

    function populateMeasurementDropdown(measurements) {
        measurementSelect.innerHTML = ''; // Clear previous options
        measurements.forEach(measurement => {
            const option = document.createElement('option');
            option.value = measurement;
            option.textContent = measurement.charAt(0).toUpperCase() + measurement.slice(1);
            measurementSelect.appendChild(option);
        });
    }

    // Update selected measurements list
    function updateSelectedList() {
        selectedList.innerHTML = '';
        selectedMeasurements.forEach(measurement => {
            const option = document.createElement('option');
            option.value = measurement;
            option.textContent = measurement;
            selectedList.appendChild(option);
        });
        sendQuery();
    }

    // Add measurement
    addMeasurementButton.addEventListener('click', () => {
        const selectedOption = measurementSelect.value;
        if (selectedOption && !selectedMeasurements.includes(selectedOption)) {
            selectedMeasurements.push(selectedOption);
            updateSelectedList();
        }
    });

    // Remove measurement
    removeMeasurementButton.addEventListener('click', () => {
        const selectedOption = selectedList.selectedOptions[0];
        if (selectedOption) {
            selectedMeasurements = selectedMeasurements.filter(m => m !== selectedOption.value);
            updateSelectedList();
        }
    });

    // Send query to fetch real-time data
    async function sendQuery() {
        if (selectedMeasurements.length === 0) return;

        const query = { measurements: selectedMeasurements };

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            console.log('Real-time query result:', result);
        } catch (error) {
            console.error('Error fetching real-time data:', error);
        }
    }

    // WebSocket Listener for Live Updates
    socket.on('live_data', (data) => {
        console.log('Live data received:', data);
        updateChart(data);
    });

    // Update Chart.js with new data
    function updateChart(data) {
        comparisonChart.data.labels = data.timestamps;
        comparisonChart.data.datasets = selectedMeasurements.map((measurement, index) => ({
            label: measurement,
            data: data.values[measurement] || [],
            borderColor: `hsl(${index * 60}, 70%, 50%)`,
            fill: false
        }));
        comparisonChart.update();
    }

    // Save user query
    saveQueryButton.addEventListener('click', async () => {
        const queryName = queryNameInput.value.trim();
        if (!queryName) {
            alert('Please enter a query name.');
            return;
        }

        const query = { name: queryName, measurements: selectedMeasurements };

        try {
            const response = await fetch('/api/save_query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(query)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = await response.json();
            alert('Query saved successfully!');
            queryNameInput.value = ''; // Clear input field
            loadSavedQueries();
        } catch (error) {
            console.error('Error saving query:', error);
        }
    });

    // Load saved queries
    async function loadSavedQueries() {
        try {
            const response = await fetch('/api/saved_queries');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            populateSavedQueries(data.saved_queries);
        } catch (error) {
            console.error('Error loading saved queries:', error);
        }
    }

    function populateSavedQueries(queries) {
        queryList.innerHTML = '';
        queries.forEach(query => {
            const listItem = document.createElement('li');
            listItem.textContent = query.name;
            listItem.addEventListener('click', () => {
                selectedMeasurements = [...query.measurements];
                updateSelectedList();
            });
            queryList.appendChild(listItem);
        });
    }

    // Initial fetch
    fetchMeasurements();
    loadSavedQueries();
});
