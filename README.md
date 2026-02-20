<div align="center">
  <img width="1200" height="475" alt="" src="" />
</div>

# ParentGuard - Parental Control Dashboard

A secure, modern web dashboard for monitoring child devices, managing application usage, defining geofences, and ensuring web safety. 

## 🌟 Features

* **Device Management:** Pair and manage multiple child devices securely from a single parent account using pairing codes.
* **App Usage & Rules:** Monitor daily screen time, set schedules, and remotely lock/unlock specific apps.
* **Real-time Location & Geofencing:** Track the device's live location and define Safe/Danger zones (geofences) with automatic alerts.
* **Web Safety:** Block inappropriate categories, restrict specific URLs, and monitor browsing history.
* **Smart AI Insights:** Optionally analyze browsing behavior for risks using integrated AI analysis.

---

## 🚀 Getting Started

Follow these step-by-step instructions to set up and run the project locally on your machine.

### Prerequisites

Before you begin, ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v14 or higher recommended)
* **MongoDB**: You need a running MongoDB database. You can use a free cloud cluster from [MongoDB Atlas](https://www.mongodb.com/atlas) or run it locally.

### Step-by-Step Installation

**1. Open the project folder** Open your terminal or command prompt and navigate to the root folder of your project.

**2. Install dependencies** Install all required Node packages (Express, Mongoose, Socket.io, etc.) by running:
```bash
npm install

```

**3. Set up environment variables** Create a new file named `.env` in the root directory of your project. Add the following variables to connect your database and enable features:

```env
# Your MongoDB Connection String
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/?retryWrites=true&w=majority"

# API Key for the Web Safety AI Analysis feature
GEMINI_API_KEY="your_api_key_here"

# Server Configuration
PORT=3000
NODE_ENV="development"

```

**4. Start the server** Once everything is installed and configured, start your application by running:

```bash
npm start

```

*(Note: You can also use `node server.js` or `npm run dev`)*

If successful, your terminal should display:

```text
✅ Connected to MongoDB
🚀 Server running on port 3000

```

**5. Access the Dashboard** Open your web browser and navigate to: http://localhost:3000

From here, you can create a new parent account, log in, and begin generating pairing codes to connect your child devices.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js, Socket.io (for real-time device pairing)
* **Database:** MongoDB (via Mongoose)
* **Frontend:** HTML/CSS/JavaScript, Tailwind CSS, Lucide Icons
* **Maps:** Leaflet.js (for Geofencing and Location tracking)
* **Authentication:** JWT (JSON Web Tokens)

```

```
