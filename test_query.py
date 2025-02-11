import unittest
from unittest.mock import MagicMock
import json

class TestYourClass(unittest.TestCase):
    def setUp(self):
        # Create an instance of the class that contains fetch_queries
        self.your_class_instance = YourClass(bucket='test_bucket', org='test_org')
        
        # Mock the query_api.query method
        self.your_class_instance.query_api = MagicMock()
        
        # Mock data to return from the query
        mock_data = [
            {
                "values": {"query_name": "Temp", "_value": json.dumps({
                    "measurements": [
                        "Chicago/home_002/temperature",
                        "Chicago/home_003/temperature",
                        "Chicago/home_004/temperature",
                        "Miami/home_001/temperature"
                    ]
                })}
            },
            {
                "values": {"query_name": "humadity", "_value": json.dumps({
                    "measurements": [
                        "Chicago/home_001/humidity",
                        "Chicago/home_002/humidity",
                        "Chicago/home_003/humidity"
                    ]
                })}
            }
        ]
        
        self.your_class_instance.query_api.query.return_value = mock_data

    def test_fetch_queries(self):
        # Call the fetch_queries method
        result = self.your_class_instance.fetch_queries()
        
        # Define the expected result
        expected_result = [
            {
                "query_name": "Temp",
                "query_structure": {
                    "measurements": [
                        "Chicago/home_002/temperature",
                        "Chicago/home_003/temperature",
                        "Chicago/home_004/temperature",
                        "Miami/home_001/temperature"
                    ]
                }
            },
            {
                "query_name": "humadity",
                "query_structure": {
                    "measurements": [
                        "Chicago/home_001/humidity",
                        "Chicago/home_002/humidity",
                        "Chicago/home_003/humidity"
                    ]
                }
            }
        ]
        
        # Assert that the result matches the expected result
        self.assertEqual(result, expected_result)

if __name__ == '__main__':
    unittest.main()
