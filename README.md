# 📝 Todo-App  
**A Fullstack Collaborative To-Do Manager (Under Development)**  
![status](https://img.shields.io/badge/status-under_development-yellow)

## 📖 Overview
**Todo-App** is a fullstack task management system designed to help individuals and teams manage their day-to-day activities efficiently.
It supports **real-time collaboration**, **push notifications**, and **cross-device synchronization** powered by modern web technologies.

> **Developer:** Israel Olasehinde Oluwaseun

---

## 🚀 Features

### ✅ Completed
- Secure **authentication** (JWT-based)
- **Task management** with lists and due dates  
- **Web Push Notifications** (VAPID-powered)  
- **Cross-browser notifications** (Chrome, Edge, Firefox supported)  
- **Socket.IO real-time updates** across devices  
- **Recurring task scheduling** (via CRON)  
- **HTTPS** local development setup  

### 🚧 In Progress
- Team task collaboration UI  
- Advanced analytics and reminders dashboard  

---

## 🧠 Current Milestone
The current milestone focuses on **cross-browser notification support** and **secure HTTPS local development**.  
Push notifications are now functional across browsers using **VAPID keys** — with specific handling for **Microsoft Edge (WNS)** and **Chrome/Firefox (FCM)** endpoints.

---

## ⚙️ Environment Variables

Create a `.env` file in the backend root directory and include the following:

```env
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_jwt_secret>
PORT=5000
VAPID_PUBLIC_KEY=<your_generated_vapid_public_key>
VAPID_PRIVATE_KEY=<your_generated_vapid_private_key>
🧩 Tech Stack
Frontend: React (CRA)
Backend: Node.js, Express
Database: MongoDB
Real-time: Socket.IO
Notifications: Web Push API (VAPID)
Scheduler: Node-Cron
Auth: JWT

🧰 Running the Project
1️⃣ Backend
cd backend
npm install
npm start
2️⃣ Frontend
cd frontend
npm install
npm start
Ensure both frontend and backend .env files are configured correctly.
For local push notifications, HTTPS must be enabled.

🔔 Web Push Notifications (VAPID)
The app uses VAPID (Voluntary Application Server Identification) to send browser notifications.
These are managed by the backend (web-push package) and delivered via browser service workers.

Notes:
Chrome & Firefox use the fcm.googleapis.com endpoint.

Microsoft Edge uses the wns2.notify.windows.com endpoint.

The app automatically detects and manages both types for compatibility.


👨‍💻 Maintained by
Israel Olasehinde Oluwaseun