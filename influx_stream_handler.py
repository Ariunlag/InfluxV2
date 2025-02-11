import threading
from flask_socketio import emit

class StreamHandler(object):
    def __init__(self, influx_client, socketio):
        self.influx_client = influx_client
        self.socketio = socketio
        self.query_thread = None
        self.stop_event = threading.Event()
        self.latest_timestamp = None

    def start_stream(self, measurements, time_range, aggregation):
        # Stop existing stream
        self.stop_stream()

        def stream_data():
            print("Starting query stream...")
            while not self.stop_event.is_set():
                try:
                    result_stream = self.influx_client.query_data(measurements, time_range, aggregation)
                    if not result_stream:
                        print("No data, waiting...")
                        self.stop_event.wait(30)
                        continue  

                    for table in result_stream:
                        for record in table.records:
                            record_time = record.get_time()
                            if self.latest_timestamp is None or record_time > self.latest_timestamp:
                                self.latest_timestamp = record_time
                                data = {
                                    "timestamp": str(record_time),
                                    "value": record.get_value(),
                                    "measurement": record.values.get("_measurement")
                                }
                                print(f"Emitting data: {data}")
                                self.socketio.emit('dataUpdate', data)

                    self.stop_event.wait(30)  # Wait before next query

                except Exception as e:
                    print(f"Error in query stream: {e}")
                    self.stop_event.wait(30)

            print("Query stream stopped.")

        # Start a new query thread
        self.stop_event.clear()
        self.query_thread = threading.Thread(target=stream_data, daemon=True)
        self.query_thread.start()
        print("New query thread started.")

    def stop_stream(self):
        if self.query_thread and self.query_thread.is_alive():
            print("Stopping existing query stream...")
            self.stop_event.set()
            self.query_thread.join(timeout=5)
            if self.query_thread.is_alive():
                print("Warning: Query thread did not terminate in time!")

    def is_running(self):
        return self.query_thread and self.query_thread.is_alive()



'''

    try:     
        data = request.json 
        print(f"Received data: {data}")

        measurements = data.get('measurements', [])
        print(f"Measurements received: {measurements}")  
        time_range = data.get('timeRange', None)
        aggregation = data.get('aggregation', None)

        new_config = (tuple(measurements), time_range, aggregation)

        # Stop previous stream first
        if query_thread and query_thread.is_alive():
            print("Stopping previous query thread...")
            stop_event.set()
            query_thread.join(timeout=5)  # Use a timeout to avoid blocking indefinitely
            if query_thread.is_alive():
                print("Warning: Old query thread did not terminate in time!")

        if not query_thread or not query_thread.is_alive():
            print("Query config unchanged, but no active thread. Restarting...")
        else:
            print("Query is unchanged. No need to restart stream.")    
        
        
        # Update config
        query_config = new_config  
        stop_event = threading.Event()  # Reset event for the new thread
        latest_timestamp = None


        def stream_data():
            global latest_timestamp
            print("Starting data stream thread...")  # DEBUG: Confirm thread starts

            while not stop_event.is_set():  
                try:
                    print("Querying InfluxDB...")  # DEBUG
                    result_stream = influx_client.query_data(measurements, time_range, aggregation)
                    
                    if not result_stream:
                        print("No data returned from InfluxDB")
                        stop_event.wait(30)  # Wait instead of time.sleep()
                        continue  # Skip to next iteration

                    print("Query executed, processing results") 

                    for table in result_stream: 
                        for record in table.records: 
                            record_time = record.get_time() 
                            if latest_timestamp is None or record_time > latest_timestamp: 
                                latest_timestamp = record_time 
                                data = {
                                        "timestamp": str(record_time), 
                                        "value": record.get_value(),
                                        "measurement": record.values.get("_measurement") 
                                    }
                                print(f"Emitting data: {data}") 
                                socketio.emit('dataUpdate', data)

                    if stop_event.is_set():  # Force stop before waiting
                        print("Stop event set. Exiting thread immediately.")
                        break
                    stop_event.wait(30)  # Stop waiting if stop_event is set
                except Exception as e:
                    print(f"Error in stream_data: {e}")
                    stop_event.wait(30)  # Ensure it stops when needed

            print("Thread exiting...")  # DEBUG: Confirm thread stops

        # Start new stream
        query_thread = threading.Thread(target=stream_data, daemon=True)
        query_thread.start()

        print("New query thread started.")  # DEBUG
        return jsonify({"status": "query restarted"})

    except Exception as e:
        print(f"Error in /api/query: {e}")  # DEBUG: Catch unexpected errors
        return jsonify({"error": str(e)})
        
        # Initialize global variables
    query_thread = None
    query_config = None
    stop_event = threading.Event()
    latest_timestamp = None
        '''