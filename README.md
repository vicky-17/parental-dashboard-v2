# Parental Control Dashboard

A full-stack web dashboard for monitoring child device activity. This web interface receives GET and POST requests from the client Android tracking application, logging app usage details securely into MongoDB.

## 📂 Project Structure

- **`/api`**: Node.js/Express backend handling database connections and incoming data from the mobile app.
- **`/src`**: React/Vite frontend containing the user interface, pages, and components.
- **`/public`**: Static assets and Service Workers.

## 🚀 Local Setup Instructions

Follow these steps to run the project on your local machine:

### Prerequisites
- [Node.js](https://nodejs.org/) installed
- Git installed
- MongoDB instance (local or Atlas)

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/YOUR_USERNAME/parental-dashboard-v2.git
cd parental-dashboard-v2
\`\`\`

### 2. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Variables
Create a `.env` file in the root directory and add your database and port configurations:
\`\`\`env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
VITE_API_URL=http://localhost:5000
\`\`\`

### 4. Run the Application
**To run the backend server:**
\`\`\`bash
npm run start
\`\`\`

**To run the frontend development server (in a separate terminal):**
\`\`\`bash
npm run dev
\`\`\`

## ☁️ Deployment

- **Vercel**: The frontend will automatically build using Vite. Vercel will auto-detect the `/api` folder and convert your Express routes into Serverless Functions. Ensure your `app.js` exports the express app (`module.exports = app;`).
- **Heroku**: Heroku will automatically detect the `npm run start` script in the `package.json` and launch the Node server. Ensure you set your `.env` variables in the Heroku dashboard.