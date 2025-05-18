FROM python:3.9-slim

# Install basic utilities
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create a non-root user
RUN useradd -m -s /bin/bash coder
USER coder

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PATH="/home/coder/.local/bin:${PATH}"

# Install common Python packages
RUN pip install --user \
    numpy \
    pandas \
    matplotlib \
    requests

# Set the default command
CMD ["python"] 