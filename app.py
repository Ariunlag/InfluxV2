from flask import Flask, render_template, request, flash, redirect, url_for, jsonify
from mqtt_connection import MQTTClient
from influx_connection import InfluxClient
import query_manager
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os, time
from threading import Event
import threading

app= Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*") 
CORS(app)


mqtt_client = None
influx_client = None
subscribed_topics = []
user_queries = []

# Store running query threads
running_queries = {}  # { "section_id": {"thread": thread, "stop_event": stop_event} }


@app.route('/', methods=['GET', 'POST'])
def index():
    global mqtt_client, influx_client, query_handler

    if request.method == 'POST':
        # MQTT credentials
        mqtt_broker = request.form.get('mqtt_broker')
        mqtt_port = request.form.get('mqtt_port')
        
        # InfluxDB credentials
        influx_url = "http://localhost:8086"
        influx_org = request.form.get('influx_org')
        influx_bucket = request.form.get('influx_bucket') 
        env_var_name = request.form.get('influx_token')
        influx_token = os.getenv(env_var_name)
        
        if not influx_token:
            print(f"Environment variable '{env_var_name}' not found or is empty.")
        
        print(f"Received InfluxDB credentials: URL={influx_url}, Org={influx_org}, Bucket={influx_bucket}, Token={influx_token}")
        print(f"Received MQTT credentials: Broker={mqtt_broker}, Port={mqtt_port}")
        
        mqtt_connected = False
        influx_connected = False

        # InfluxDB client instance
        if influx_url and influx_org and influx_token:
            print(f"Attempting to connect to InfluxDB at {influx_url} with organization {influx_org} and bucket {influx_bucket}.")
            try:
                influx_client = InfluxClient(
                    url=influx_url,
                    token=influx_token,
                    org=influx_org,
                    bucket=influx_bucket
                )
                
                influx_client.connect()
                influx_connected = influx_client.is_connected
                print(f"InfluxDB connection status: {influx_connected}")
                
            except Exception as e:
                print(f"Failed to connect to InfluxDB: {e}")

        # MQTT client instance
        if mqtt_broker and mqtt_port:
            print(f"Attempting to connect to MQTT broker at {mqtt_broker}:{mqtt_port}.")
            try:
                mqtt_client = MQTTClient(
                    broker=mqtt_broker, 
                    port=int(mqtt_port),
                    influx_client=influx_client, 
                    bucket=influx_bucket, 
                    socketio=socketio
                )
                mqtt_client.connect()
                mqtt_connected = mqtt_client.is_connected
                print(f"MQTT connection status: {mqtt_connected}")
            except Exception as e:
                print(f"Failed to connect to MQTT broker: {e}")

        # Only proceed if both MQTT and InfluxDB are connected
        print(f"Checking connection status: MQTT connected = {mqtt_connected}, InfluxDB connected = {influx_connected}")
        if mqtt_connected and influx_connected:
            print("Both MQTT and InfluxDB are connected successfully.")
            return redirect(url_for('dashboard', section='default'))
        else:
            print("Failed to connect to both MQTT and InfluxDB.")
            return render_template('index.html', error="Failed to connect to both MQTT and InfluxDB")

    print("Rendering the initial index page.")
    return render_template('index.html')

@app.route('/dashboard/<section>')
def dashboard(section):

    global influx_client

    try:
        if section == 'mqtt':
            # mqtt_client.get_subscribed_topics()
            #MQTT specific logic here
            return render_template('dashboard.html', section='mqtt', mqtt_connected=True, influx_connected=True)
        
        elif section == 'influx':
            #InfluxDB specific logic here

            print("InfluxDB logic works with client connections:", influx_client)
            # influx_client.fetch_measurements_and_tags()
            return render_template('dashboard.html', section='influx', mqtt_connected=True, influx_connected=True)
        
        elif section == 'class-influx':
            #Class query specific logic here
            
            return render_template('dashboard.html', section='class-influx', mqtt_connected=True, influx_connected=True)
        
        else:
            # Default case if no section is passed
            return render_template('dashboard.html', section='home', mqtt_connected=True, influx_connected=True)
    except AttributeError as e:
        return f"An error occurred: {e}"
    except Exception as e:
        return f"An unexpected error occurred: {e}"

@app.route('/subscribe', methods=['POST'])
def subscribe():
    topic = request.form.get('mqtt_topic')
    if mqtt_client and mqtt_client.is_connected():
        if topic not in subscribed_topics:
            mqtt_client.subscribe_topic(topic)
            subscribed_topics.append(topic)
            return jsonify({"success": True, "message": f"Subscribed to {topic}"})
        else:
            return jsonify({"success": False, "message": f"Already subscribed to {topic}"})
    return jsonify({"success": False, "message": "MQTT client not connected"})

@app.route('/unsubscribe', methods=['POST'])
def unsubscribe():
    topic = request.form.get('mqtt_topic')
    if mqtt_client and mqtt_client.is_connected():
        if topic in subscribed_topics:
            mqtt_client.unsubscribe_topic(topic)
            subscribed_topics.remove(topic)
            return jsonify({"success": True, "message": f"Unsubscribed from {topic}"})
        else:
            return jsonify({"success": False, "message": f"Not subscribed to {topic}"})
    return jsonify({"success": False, "message": "MQTT client not connected"})

@app.route('/get_subscribed_topics', methods=['GET'])
def get_subscribed_topics():
    topics = mqtt_client.get_subscribed_topics()
    return jsonify(success=True, topics=topics)

# API endpoint to fetch measurements and tags
@app.route('/api/data') 
def get_data(): 
    return jsonify({
        'measurements': influx_client.measurements, 
        'tags_values': influx_client.tags_values
        })

# API endpoint to fetch queries

@app.route('/api/query', methods=['POST'])
def query():
    data = request.get_json()
    section_id = data.get("section_id", "default")
    measurements = data.get('measurements', [])
    time_range = data.get('timeRange', None)
    aggregation = data.get('aggregation', None)

    response = query_manager.start_query(section_id, measurements, time_range, aggregation, influx_client, socketio)
    return jsonify(response)

# @app.route('/api/query', methods=['POST'])
# def query():
#     global query_config, stop_event, query_thread  #энэ бас асуудалтай
#     data = request.get_json()
#     print(f"Received query @main app: {data}")
#     measurements = data.get('measurements', [])
#     print(f"Measurements received: {measurements}")  
#     time_range = data.get('timeRange', None)
#     aggregation = data.get('aggregation', None)

#     print("Checking InfluxDB client before querying...")
#     print(f"influx_client: {influx_client}, type: {type(influx_client)}")

#     try:
#         print("Querying InfluxDB...")
#         result = influx_client.query_data(measurements, time_range, aggregation)
#         return jsonify(result)
#     except Exception as e:
#         print(f"Error while querying InfluxDB: {e}")

#         return jsonify({"error": str(e)}), 500

@app.route('/api/save_query', methods=['POST'])
def save_query():
    try:
        data = request.json
        print("Incoming data:", data)
        query_name = data.get("query_name")
        measurements = data.get("measurements")

        if not query_name or not measurements:
            return jsonify({"error": "Missing query_name or measurements"}), 400

        result = influx_client.save_query(query_name, measurements)
        return jsonify(result), 200

    except Exception as e:
        print("Exception occurred:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/api/user_queries", methods=["GET"])
def fetch_queries():
    try:
        user_queries = influx_client.fetch_queries()
        return jsonify({"queries": user_queries }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/query/<query_name>", methods=["POST"])
def run_query(query_name):
    data = request.json
    time_range = data.get('timeRange', None)
    aggregation = data.get('aggregation', None)

    try:
        user_queries = influx_client.fetch_queries()
        measurements = influx_client.extract_measurements(query_name, user_queries)
        if measurements is None:
            return jsonify({"error": "Query not found"}), 404

        result = influx_client.query_data(measurements, time_range, aggregation)
        if "error" in result:
            return jsonify(result), 404
        return jsonify(result), 200
    except Exception as e:
        print(f"[ERROR] Exception in run_query: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/query/<query_name>", methods=["DELETE"])
def delete_query(query_name):
    try:
        print(f"[DEBUG] Route handler called with query_name: {query_name}")
        user_queries = influx_client.fetch_queries()
        print(f"[DEBUG] Fetched user_queries: {user_queries}")

        # Find the query_structure for the provided query_name
        query_structure = None
        for query in user_queries:
            if query['query_name'] == query_name:
                query_structure = query['query_structure']
                break

        if not query_structure:
            print(f"[ERROR] Query structure not found for query_name: {query_name}")
            return jsonify({"error": "Query structure not found"}), 404

        # Delete the query using the delete_query method
        result = influx_client.delete_query(query_name, query_structure, user_queries)
        if "error" in result:
            return jsonify(result), 404

        # Update user_queries by refetching the queries
        user_queries = influx_client.fetch_queries()
        print(f"[DEBUG] Updated user_queries: {user_queries}")

        return jsonify(result), 200
    except Exception as e:
        print(f"[ERROR] Exception in delete_query: {e}")
        return jsonify({"error": str(e)}), 500


@socketio.on('connect') 
def handle_connect(): 
    emit('connected', {'data': 'Connected to server'})


@app.route('/logout', methods=['POST'])
def logout():
    if mqtt_client and mqtt_client.is_connected():
        mqtt_client.disconnect()
    if influx_client and influx_client.is_connected:
        influx_client.close()
    return redirect(url_for('index')) 

    
if __name__ == '__main__':
    socketio.run(app, debug=True)