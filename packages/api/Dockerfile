FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt requirements.lock .
RUN pip install --no-cache-dir -r requirements.txt -c requirements.lock

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run the application
CMD ["python", "run.py"]
