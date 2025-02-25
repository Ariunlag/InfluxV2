import threading
import time
from flask_socketio import SocketIO

# Store running queries
running_queries = {}  # { "section_id": {"thread": thread, "stop_event": stop_event} }

def stop_existing_query(section_id):
    """Stops any running query in the given section"""
    if section_id in running_queries:
        print(f"Stopping existing query for section: {section_id}")
        running_queries[section_id]["stop_event"].set()
        running_queries[section_id]["thread"].join()
        del running_queries[section_id]

def stream_query_data(section_id, measurements, time_range, aggregation, stop_event, influx_client, socketio: SocketIO):
    """Streams real-time query data via WebSocket"""
    try:
        while not stop_event.is_set():
            result_json = influx_client.query_data(measurements, time_range, aggregation)

            if not result_json:
                print(f"No data to emit for {section_id}")
                 # Wait 5 seconds but check stop_event frequently
                start_time = time.time()
                while (time.time() - start_time) < 5 and not stop_event.is_set():
                    time.sleep(0.1)
                continue
            print(f"Emitting {len(result_json)} records to frontend for {section_id}")

            socketio.emit(f"dataUpdate_{section_id}", result_json)
            start_time = time.time()
            while (time.time() - start_time) < 5 and not stop_event.is_set():
                time.sleep(0.1)
                
            time.sleep(10)  # Update every 5 seconds
    except Exception as e:
        print(f"[ERROR] Streaming failed for {section_id}: {e}")

def start_query(section_id, measurements, time_range, aggregation, influx_client, socketio: SocketIO):
    """Stops previous query and starts a new one"""
    stop_existing_query(section_id)

    stop_event = threading.Event()
    thread = threading.Thread(target=stream_query_data, args=(section_id, measurements, time_range, aggregation, stop_event, influx_client, socketio))
    thread.start()

    running_queries[section_id] = {"thread": thread, "stop_event": stop_event}
    return {"message": "Query started", "section_id": section_id}
