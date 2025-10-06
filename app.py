import os
from flask import Flask, request, jsonify, render_template # Add render_template
import pandas as pd

# Create a Flask web server instance
app = Flask(__name__)

# Set up a folder to temporarily save uploaded files.
# Make sure to create this folder in your project directory.
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# A simple route to serve our main page
@app.route('/')
def home():
    return render_template('index.html') # This will now serve the HTML file

# The main route for handling CSV file uploads
@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if a file was included in the request
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']

    # Check if the file has a name
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Ensure the file is a CSV
    if file and file.filename.endswith('.csv'):
        # Save the uploaded file to our temporary folder
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)

        try:
            # Read the CSV file into a pandas DataFrame
            df = pd.read_csv(filepath)

            # Convert the DataFrame to a JSON format that's easy to work with
            # 'records' is a good format as it gives a list of dictionaries
            # where each dictionary is a row.
            json_data = df.to_json(orient='records')

            # Clean up the temporary file
            os.remove(filepath)

            # Return the JSON data to the frontend
            return json_data, 200

        except Exception as e:
            # Handle any errors during file processing (e.g., malformed CSV)
            return jsonify({"error": f"An error occurred while processing the file: {e}"}), 500

    return jsonify({"error": "File type not supported. Please upload a .csv file."}), 415

@app.route('/transpose', methods=['POST'])
def transpose_data():
    try:
        # Receive the JSON data from the frontend
        json_data = request.get_json()
        
        # Convert the JSON back to a pandas DataFrame
        df = pd.DataFrame(json_data)
        
        # Determine the name of the categorical column (e.g., 'Gene') dynamically
        # We assume the first column that is not a number is the category column
        category_column = None
        for col in df.columns:
            if not pd.api.types.is_numeric_dtype(df[col]):
                category_column = col
                break
        
        if category_column is None:
            return jsonify({"error": "No non-numeric column found to use as category."}), 400

        # Set the category column as the index for transposition
        df = df.set_index(category_column)
        
        # Transpose the DataFrame
        df_transposed = df.T
        
        # Reset the index and give it a new name
        df_transposed = df_transposed.reset_index().rename(columns={'index': 'Category'})
        
        # Return the transposed data as JSON
        return df_transposed.to_json(orient='records'), 200
    
    except Exception as e:
        return jsonify({"error": f"An error occurred during transposition: {e}"}), 500

if __name__ == '__main__':
    # Run the server. In production, you'd use a more robust server.
    app.run(debug=True)