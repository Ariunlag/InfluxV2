import paho.mqtt.client as mqtt
import socket
import json
import threading
import time

class MQTTClient:
    def __init__(self, broker, port, influx_client=None, bucket=None, socketio=None):
        self.broker = broker
        self.port = port
        self.subscribed_topics = set()

        
        self.client = mqtt.Client()
        self.influx_client = influx_client
        self.bucket = bucket
        self.connected = False
        self.data = []
        self.lock = threading.Lock()  # For thread safety
        self.socketio = socketio

    def connect(self):
        try:

            # Test broker connection
            sock = socket.create_connection((self.broker, self.port))
            sock.close()

            # Establish MQTT connection
            self.client.connect(self.broker, self.port, 60)
            self.client.on_message = self.on_message
            self.client.loop_start()
            self.connected = True
            print(f"Connected to {self.broker}:{self.port}")
            return True
        except Exception as e:
            print(f"Failed to connect to {self.broker}:{self.port} - {e}")
            self.connected = False
            return False

    def is_connected(self):
        return self.connected

    def subscribe_topic(self, topic):
        if self.connected:
            self.client.subscribe(topic)
            self.subscribed_topics.add(topic)
            print(f"Subscribed to topic '{topic}'")
            print(f"Connected to topic '{self.subscribed_topics}'")

    def get_subscribed_topics(self):
        return list(self.subscribed_topics)

    def unsubscribe_topic(self, topic):
        if self.connected:
            self.client.unsubscribe(topic)
            self.subscribed_topics.remove(topic)
            print(f"Unsubscribed from topic '{topic}'")
            print(f"Connected to topic '{self.subscribed_topics}'")

    def on_message(self, client, userdata, msg):
    # Decode the payload
        payload = msg.payload.decode()
        # print(f"Received '{payload}' from '{msg.topic}'")
        
        try:
            # Parse the JSON payload once
            data = json.loads(payload)

            # Append data to self.data list with threading lock for safety
            with self.lock:
                self.data.append({
                    "topic": msg.topic,

                    "fields": {
                    "timestamp": data.get("fields", {}).get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ")),  
                    "value": data.get("fields", {}).get("value")
                },
                    "tags": data.get("tags", {})
                })

            # Emit the message to the frontend for real-time display if socketio is set
            if self.socketio:
                self.socketio.emit('mqtt_data', {'data': self.data})
                # print emitted data for debugging
                # print("Emitted data:", self.data)

            # Debug: Print the state of influx_client and bucket 
            if self.influx_client and self.bucket: 
                fields = data.get("fields", {})
                tags = data.get("tags", {})
                timestamp = data.get("timestamp", None)
                measurement = msg.topic       

                # Call write_data from InfluxClient to save data
                self.influx_client.write_data(
                    bucket=self.bucket, 
                    measurement=measurement, 
                    tags=tags, 
                    fields=fields
                    )
                # print(f"Data saved to InfluxDB: Measurement='{measurement}', Tags={tags}, Fields={fields}")

            else:
                print("InfluxDB client is not initialized or missing 'bucket'.")
        
        except json.JSONDecodeError:
            print(f"Failed to decode JSON: {payload}")
        except Exception as e:
            print(f"Error processing message payload: {e}")



    def get_data(self):
        with self.lock: 
            return self.data
        

    def disconnect(self):
        self.client.disconnect()
        self.connected = False
        self.subscribed_topics.clear()
        print("Disconnected from MQTT broker")
        self.client.loop_stop()