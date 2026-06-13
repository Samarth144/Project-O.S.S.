# Use the official Node.js 20 image
FROM node:20

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install application dependencies
RUN npm ci

# Copy the remaining project files
COPY . .

# Expose port 3000 for the Express server
EXPOSE 3000

# Start the application
CMD [ "npm", "start" ]
