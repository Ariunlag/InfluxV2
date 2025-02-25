import os
import json
from dotenv import load_dotenv
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.exceptions import InfluxDBError
from influxdb_client import DeleteApi
from datetime import datetime, timezone 


class InfluxClient:
    def __init__(self, url, token, org, bucket):
        self.url = url
        self.token = token
        self.org = org
        self.bucket = bucket
        self.client = None
        self.write_api = None
        self.query_api = None
        self.delete_api = None # Initialize DeleteApi
        self.connected = False
        self.measurements =[]
        self.tags_values = {}
        self.fetch_measurements_and_tags()
        
        
                
    def connect(self):
            try:
                self.client = InfluxDBClient(url=self.url, token=self.token)
                self.write_api = self.client.write_api()
                self.query_api = self.client.query_api()
                self.delete_api = self.client.delete_api()
            

                # self.test_write()
                # Attempt a simple health check to verify credentials
                print("Performing health check...")
                health = self.client.health()
                print(f"Health object: {health}")
                
                if hasattr(health,'status'):
                    print(f"InfluxDB health: {health.status}")
                else:
                    print("Health status attribute not found")

                if not self.client.ping(): 
                    print("InfluxDB server is not reachable")
                    raise ConnectionError("InfluxDB server is not reachable")
                
                self.connected = True

                # Fetch measurements and tags after successful connection
                self.fetch_measurements_and_tags()
                # self.display_tags_and_values()
        
                   
            except InfluxDBError as e:
                print(f"InfluxDB connection failed: {e}")
                self.connected = False    

    def fetch_measurements_and_tags(self):
        try:
            # Query for measurements
            print("Fetching measurements...")
            measurements_query = f'''
            import "influxdata/influxdb/schema"
            schema.measurements(bucket: "{self.bucket}")
            '''
            measurements_result = self.query_api.query(org=self.org, query=measurements_query)
            self.measurements = [record.get_value() for table in measurements_result for record in table.records]
            print(f"Measurements fetched: {self.measurements}")


            # Fetch tags for each measurement
            self.tags_values = {}
            for measurement in self.measurements:
                tags_query = f'''
                import "influxdata/influxdb/schema"
                schema.tagKeys(bucket: "{self.bucket}", predicate: (r) => r._measurement == "{measurement}")
                '''
                tags_result = self.query_api.query(org=self.org, query=tags_query)
                tag_keys = [record.get_value() for table in tags_result for record in table.records]

                self.tags_values[measurement] = {}
                for tag_key in tag_keys:
                    if not tag_key.startswith("_"):
                        tag_values_query = f'''
                        import "influxdata/influxdb/schema"
                        schema.tagValues(bucket: "{self.bucket}", tag: "{tag_key}", predicate: (r) => r._measurement == "{measurement}")
                        '''
                        tag_values_result = self.query_api.query(org=self.org, query=tag_values_query)
                        tag_values = [record.get_value() for table in tag_values_result for record in table.records]
                        self.tags_values[measurement][tag_key] = tag_values

            print(f"Measurements: {self.measurements}")
            print(f"Tags and values: {self.tags_values}")

    
        except Exception as e:
            print(f"Failed to fetch measurements or tags: {e}")
            self.measurements = []
            self.tags = {}
     
    def is_connected(self):
        return self.connected
    
    def test_write(self): 
        point = Point("test_measurement").tag("tag_key", "tag_value").field("field_key", 1) 
        
        try: 
            self.write_api.write(bucket=self.bucket, org=self.org, record=point) 
            print("Test write successful") 
        except Exception as e: 
            print(f"Test write failed: {e}")

    def write_data(self, bucket, measurement, tags, fields):
        if not self.client: 
            raise ValueError("InfluxDB client is not initialized.")
        
        if self.is_connected():
            point = Point(measurement)
            for tag_key, tag_value in tags.items():
                point = point.tag(tag_key, tag_value)

            for field_key, field_value in fields.items():
                point = point.field(field_key, field_value)

            self.write_api.write(bucket=bucket, org=self.org, record=point)
            # print("Data written to InfluxDB successfully.")

    def query_data(self, measurements: list, time_range: str = None, aggregation: str = None):

        if not measurements or not isinstance(measurements, list):
            raise ValueError("Measurements must be a non-empty list.")

        measurements = [item for sublist in measurements for item in sublist] if any(isinstance(m, list) for m in measurements) else measurements

        time_range_mapping = {"lastHour": "-1h", "last12Hours": "-12h", "last24Hours": "-24h"}
        aggregation_mapping = {"average": "mean", "max": "max", "min": "min"}

        flux_time_range = time_range_mapping.get(time_range, "-24h")
        flux_aggregation = aggregation_mapping.get(aggregation, "mean")

        window_period_mapping = {"lastHour": "5m", "last12Hours": "30m", "last24Hours": "1h"}
        window_period = window_period_mapping.get(time_range, "1m")

        measurement_conditions = " or ".join([f'r["_measurement"] == "{m}"' for m in measurements])

        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: {flux_time_range})
        |> filter(fn: (r) => {measurement_conditions})
        |> aggregateWindow(every: {window_period}, fn: {flux_aggregation}, createEmpty: false)
        |> yield(name: "{flux_aggregation}")
        '''

        print(f"Constructed Query: {query}")
        try:
            result = self.query_api.query(query=query, org=self.org)
            print(f"Query result at influx_connection: {result}")
        except Exception as e:
            print(f"[ERROR] Query execution failed: {e}")
            return {"error": str(e)}

        # Process the result to make it JSON serializable
        result_json = []
        for table in result:
            for record in table.records:
                record_json = {
                    "timestamp": record.get_time().isoformat(),
                    "value": record.get_value(),
                    "measurement": record.get_measurement()
                }
                result_json.append(record_json)

        return result_json
        print(f"Processed JSON Result: {result_json}") 

    def save_query(self, query_name: str, measurements: list):
        try:
            print("[DEBUG] Starting save_query function")

            print(f"[DEBUG] Saving query: {query_name} with measurements: {measurements}")

            # Create the Point with the correct data
            point = Point("user_queries").tag("query_name", query_name).field("measurements", json.dumps(measurements))
            print(f"[DEBUG] Writing query: {point}")

            # Write the data to InfluxDB
            self.write_api.write(bucket=self.bucket, org=self.org, record=point)

            # Update the user_queries dictionary
            global user_queries
            user_queries[query_name] = measurements

            print(f"[DEBUG] Query '{query_name}' saved successfully!")
            return {"message": "User query saved successfully!"}

        except Exception as e:
            print(f"[ERROR] Failed to save query: {e}")
            return {"error": str(e)}

    def fetch_queries(self):
        try:
            # Query to fetch all queries from the user_queries measurement
            query = f'''
                from(bucket: "{self.bucket}")
                    |> range(start: -1y)  
                    |> filter(fn: (r) => r._measurement == "user_queries")  
            '''
            result = self.query_api.query(query, org=self.org)

            queries = []
            for table in result:
                for record in table.records:
                    query_name = record.values.get("query_name")
                    query_structure_json = record.get_value()  # The actual query structure in JSON form
                    
                    if query_structure_json:
                        query_structure = json.loads(query_structure_json)  # Parse the JSON structure
                    else:
                        query_structure = {}  # Handle case when there’s no valid structure
                    
                    queries.append({
                        "query_name": query_name,
                        "query_structure": query_structure
                    })

            # Return the queries, or an empty list if none found
            return queries if queries else []

        except Exception as e:
            print(f"[ERROR] Failed to fetch queries: {e}")
            return {"error": str(e)}


    def extract_measurements(self, query_name: str, user_queries: list):
        print(f"[DEBUG] Extracting measurements for query: {query_name}")

        # Search through the list of queries for the given query_name
        for query in user_queries:
            if query['query_name'] == query_name:
                query_structure = query['query_structure']
                print(f"[DEBUG] Found query_structure: {query_structure}")

                # Handle different types of query_structure
                if isinstance(query_structure, dict) and 'measurements' in query_structure.get('query_structure', {}):
                    measurements = query_structure['query_structure']['measurements']
                elif isinstance(query_structure, list):
                    measurements = query_structure
                else:
                    print("[ERROR] Invalid query_structure format")
                    return None

                return measurements

        print("[ERROR] Query not found")
        return None


    def delete_query(self, query_name: str, query_structure, user_queries: list):
        try:
            print(f"[influx connection] Deleting query: {query_name}")

            # Remove ALL instances of the query from the list
            initial_count = len(user_queries)
            user_queries = [
                q for q in user_queries
                if not (q["query_name"] == query_name and q["query_structure"] == query_structure)
            ]
            if len(user_queries) == initial_count:
                print(f"[ERROR] Query '{query_name}' not found")
                return {"error": "Query not found"}

            # Delete existing data from InfluxDB
            start = "1970-01-01T00:00:00Z"
            stop = "2200-01-01T00:00:00Z"
            try:
                self.delete_api.delete(
                    start=start,
                    stop=stop,
                    predicate='_measurement="user_queries"',
                    bucket=self.bucket,
                    org=self.org
                )
                print("[influx connection] Old data deleted from InfluxDB")
            except Exception as delete_error:
                print(f"[ERROR] Delete operation failed: {delete_error}")
                return {"error": "Failed to clear old data"}

            # Prepare updated data for InfluxDB
            points = []
            for query in user_queries:
                point = Point("user_queries") \
                    .tag("query_name", query["query_name"]) \
                    .field("query_structure", json.dumps(query["query_structure"]))
                points.append(point)

            # Write new data
            self.write_api.write(bucket=self.bucket, org=self.org, record=points)
            print(f"[influx connection] Saved {len(points)} queries")
            return {"message": "Query deleted successfully"}

        except Exception as e:
            print(f"[ERROR] Critical failure: {e}")
            return {"error": str(e)}
        


    

    
 






    def close(self):
        if self.is_connected():
            # Release resources to avoid memory leaks
            if self.write_api:
                self.write_api.__del__()
                self.write_api = None
            if self.query_api:
                self.query_api.__del__()
                self.query_api = None

            # Close the client connection before exiting
            self.client.close()
            self.client = None

            self.connected = False
            print("InfluxDB connection closed.")

