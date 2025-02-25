import paho.mqtt.client as mqtt
import socket
import json
import threading
import time
from datetime import datetime

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
        payload = msg.payload.decode()

        try:
            data = json.loads(payload)

            fields = data.get("fields", {})
            tags = data.get("tags", {})
            timestamp_unix = fields.get("timestamp")

            if timestamp_unix is not None:
                timestamp_datetime = datetime.fromtimestamp(timestamp_unix)
                timestamp_str = timestamp_datetime.isoformat()
            else:
                timestamp_str = time.strftime("%Y-%m-%dT%H:%M:%SZ")

            # Dynamically get the field name and value
            for field_name, field_value in fields.items(): # Iterate over the fields
                if field_name != "timestamp": 
                    new_data_point = {
                        "topic": msg.topic,
                        "fields": {
                            "timestamp": timestamp_str,
                            field_name: field_value # Use the dynamic field name
                        },
                        "tags": tags
                    }

                    if self.socketio:
                        self.socketio.emit('mqtt_data', {'data': [new_data_point]})

                    if self.influx_client and self.bucket:
                        measurement = msg.topic
                        self.influx_client.write_data(
                            bucket=self.bucket,
                            measurement=measurement,
                            tags=tags,
                            fields={ field_name: field_value } # Use the dynamic field name for InfluxDB
                        )

        except json.JSONDecodeError:
            print(f"Failed to decode JSON: {payload}")
        except Exception as e:
            print(f"Error processing message payload: {e}")



    def get_data(self):
        with self.lock: 
            return self.data
        

    def disconnect(self):
        
        for topic in self.subscribed_topics:
            self.client.unsubscribe(topic)
        self.subscribed_topics.clear()
        self.client.disconnect()
        self.connected = False
        print("Disconnected from MQTT broker")
        self.client.loop_stop()