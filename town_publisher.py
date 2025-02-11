import paho.mqtt.client as mqtt
import json
import random
import time

class MQTTPublisher:
    def __init__(self, broker, port, towns, homes_per_town):
        self.broker = broker
        self.port = port
        self.towns = towns
        self.homes_per_town = homes_per_town
        self.client = mqtt.Client()

    def connect(self):
        self.client.connect(self.broker, self.port)
        print(f"Connected to MQTT broker at {self.broker}:{self.port}")

    def publish_sensor_data(self, town, home_id):
        # Generate random values for fields
        temperature = round(random.uniform(18.0, 30.0), 2)
        humidity = random.randint(30, 70)
        pressure = round(random.uniform(980, 1050), 2)

        # Create messages with unique sensor IDs
        timestamp = int(time.time())

        temperature_message = {
            "fields": {
                "temperature": temperature
            },
            "tags": {
                "home_id": f"home_{home_id:03d}",
                "location": town
            },
            "timestamp": timestamp
        }

        humidity_message = {
            "fields": {
                "humidity": humidity
            },
            "tags": {
                "home_id": f"home{home_id:03d}",
                "location": town
            },
            "timestamp": timestamp
        }

        pressure_message = {
            "fields": {
                "pressure": pressure
            },
            "tags": {
                "home_id": f"home_{home_id:03d}",
                "location": town
            },
            "timestamp": timestamp
        }

        # Publish each message to its corresponding topic
        self.client.publish(f"{town}/home_{home_id:03d}/temperature", json.dumps(temperature_message))
        self.client.publish(f"{town}/home_{home_id:03d}/humidity", json.dumps(humidity_message))
        self.client.publish(f"{town}/home_{home_id:03d}/pressure", json.dumps(pressure_message))

        print(f"Published to {town}/home_{home_id:03d}/temperature: {temperature_message}")
        print(f"Published to {town}/home_{home_id:03d}/humidity: {humidity_message}")
        print(f"Published to {town}/home_{home_id:03d}/pressure: {pressure_message}")

    def publish_random_data(self):
        while True:
            for town in self.towns:
                for home_id in range(1, self.homes_per_town + 1):
                    self.publish_sensor_data(town, home_id)

                # Sleep for a random interval between 10 and 15 seconds after publishing data for all homes in a town
                sleep_time = random.uniform(1, 5)
                print(f"Sleeping for {sleep_time:.2f} seconds before publishing next town...")
                time.sleep(sleep_time)

    def start(self):
        self.connect()
        self.publish_random_data()

if __name__ == "__main__":
    mqtt_config = {
        "broker": "test.mosquitto.org",
        "port": 1883
    }
    towns = ["New_York_City", "Los_Angeles", "Chicago", "San_Francisco", "Miami"]
    homes_per_town = 4  # Number of sensors per town

    publisher = MQTTPublisher(mqtt_config["broker"], mqtt_config["port"], towns, homes_per_town)
    try:
        publisher.start()
    except KeyboardInterrupt:
        print("Publisher stopped.")