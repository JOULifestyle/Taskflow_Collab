# 📝 Todo-App
**A Fullstack Collaborative To-Do Manager**

[![CI/CD](https://github.com/JOULifestyle/Todo-App/actions/workflows/test.yml/badge.svg)](https://github.com/JOULifestyle/Todo-App/actions/workflows/test.yml)
[![Frontend Tests](https://github.com/JOULifestyle/Todo-App/actions/workflows/test.yml/badge.svg?branch=main&event=push)](https://github.com/JOULifestyle/Todo-App/actions/workflows/test.yml)
[![Backend Tests](https://github.com/JOULifestyle/Todo-App/actions/workflows/test.yml/badge.svg?branch=main&event=push)](https://github.com/JOULifestyle/Todo-App/actions/workflows/test.yml)

## 📖 Overview
**Todo-App** is a comprehensive fullstack task management system designed to help individuals and teams efficiently manage their day-to-day activities. It features real-time collaboration, intelligent notifications, cross-device synchronization, and advanced analytics, all powered by modern web technologies.

The application allows users to create and manage multiple task lists, share them with team members with role-based permissions, set priorities and due dates, schedule recurring tasks, and receive timely reminders via push notifications. Real-time updates ensure all collaborators stay in sync, while the calendar view and analytics dashboard provide insights into productivity and task distribution.

> **Developer:** Israel Olasehinde

---

## 🚀 Features

#### 🔐 Authentication & Security
- **JWT-based authentication** with secure login/signup
- **Protected routes** ensuring only authenticated users access the app
- **HTTPS setup** for local development with SSL certificates

#### 📋 Task Management
- **Create, edit, and delete tasks** within organized lists
- **Task properties**: priority (high/medium/low), category, due dates, completion status
- **Drag-and-drop reordering** of tasks using @dnd-kit
- **Recurring tasks** with daily, weekly, or monthly schedules
- **Task ordering** for custom prioritization

#### 👥 Collaboration & Sharing
- **Create and manage multiple task lists**
- **Share lists** with other users via email invitations or direct user ID
- **Role-based permissions**: Owner (full control), Editor (modify tasks), Viewer (read-only)
- **Real-time collaboration** with Socket.IO for instant updates across all users
- **Member management** with the ability to add/remove collaborators

#### 🔔 Notifications & Reminders
- **Web Push Notifications** using VAPID (Voluntary Application Server Identification)
- **Cross-browser support**: Chrome, Firefox, Edge, and Safari
- **Intelligent reminders**: 15-minute, 5-minute, and due-time notifications
- **Fallback browser notifications** when push notifications aren't available
- **Automatic detection** of notification endpoints (FCM for Chrome/Firefox, WNS for Edge)

#### 📊 Analytics & Visualization
- **Dashboard** with task completion statistics and category breakdowns
- **Interactive charts** using Recharts library (pie charts, bar charts)
- **Task analytics**: Completion rates, category distribution, pending vs completed tasks

#### 📅 Calendar Integration
- **Calendar view** displaying tasks by due date
- **Visual indicators** for dates with scheduled tasks
- **Task details** shown for selected dates
- **Integration with task due dates** for easy scheduling overview

#### 🔄 Real-time Synchronization
- **Socket.IO-powered real-time updates** for all task changes
- **Cross-device synchronization** ensuring consistency across browsers/tabs
- **Automatic conflict resolution** for collaborative editing

#### 📱 Offline Support
- **Progressive Web App (PWA)** capabilities with service worker
- **Offline-first architecture** with cached static assets
- **Background sync** for task operations when connectivity is restored
- **Push notifications** work offline once registered
- **App shell caching** for instant loading on repeat visits

---

---

## 🧩 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **Notifications**: Web Push API with web-push library
- **Scheduling**: node-cron for recurring tasks and reminders
- **Security**: bcryptjs for password hashing, CORS for cross-origin requests

### Frontend
- **Framework**: React 19 with Create React App
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS with PostCSS
- **State Management**: React Context API
- **Charts**: Recharts for data visualization
- **Calendar**: react-calendar for date selection
- **Drag & Drop**: @dnd-kit for task reordering
- **Notifications**: Browser Notification API with service workers
- **HTTP Client**: Axios for API requests
- **Real-time**: Socket.IO client
- **PWA**: Service Worker for offline functionality and caching

### Development & Testing
- **Testing**: Jest with React Testing Library
- **Build Tool**: Webpack (via CRA)
- **Linting**: ESLint
- **Package Management**: npm

---

## ⚙️ Environment Variables

Create `.env` files in both backend and frontend root directories:

### Backend (.env)
```env
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_jwt_secret>
PORT=5000
VAPID_PUBLIC_KEY=<your_generated_vapid_public_key>
VAPID_PRIVATE_KEY=<your_generated_vapid_private_key>
NODE_ENV=development
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000
```

---

## 🧰 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

### Running the Project

1. **Clone the repository**
   ```bash
   git clone <https://github.com/JOULifestyle/Todo-App.git>
   cd todo-app
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Create .env file with required variables
   npx nodemon server.js
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   # Create .env file with REACT_APP_API_URL
   npm start
   ```

4. **Access the Application**
   - **Live Demo**: https://todo-app-sigma-gilt.vercel.app/
   - **Local Development**:
     - Frontend: http://localhost:3000
     - Backend API: http://localhost:5000

---

## 🔔 Web Push Notifications (VAPID)

The app uses VAPID (Voluntary Application Server Identification) to send browser notifications. These are managed by the backend using the `web-push` package and delivered via browser service workers.

### Browser Support Details:
- **Chrome & Firefox**: Use FCM (Firebase Cloud Messaging) endpoint `fcm.googleapis.com`
- **Microsoft Edge**: Uses WNS (Windows Notification Service) endpoint `wns2.notify.windows.com`
- **Safari**: Supported with appropriate payload formatting

The app automatically detects the browser type and manages notifications accordingly for maximum compatibility.

### Notification Types:
- **Task Creation**: Alerts when new tasks are added to shared lists
- **Task Updates**: Notifications for task modifications
- **Due Reminders**: Intelligent reminders at 15min, 5min, and due time
- **Recurring Tasks**: Automatic rescheduling and notifications
- **Deletion of Tasks**: Alerts when tasks are deleted

---

## 📁 Project Structure

```
todo-app/
├── backend/
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Authentication & authorization
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API endpoints
│   ├── sockets/        # Real-time event handlers
│   ├── utils/          # Helper functions
│   └── tests/          # Backend unit tests
├── frontend/
│   ├── public/         # Static assets
│   ├── src/
│   │   ├── api/        # API service functions
│   │   ├── components/ # Reusable UI components
│   │   ├── context/    # React context providers
│   │   ├── hooks/      # Custom React hooks
│   │   ├── pages/      # Page components
│   │   └── utils/      # Frontend utilities
│   └── tests/          # Frontend unit tests
└── README.md
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🧾 License
This project is licensed under the [MIT License](./LICENSE).


---

👨‍💻 **Maintained by**
Israel Olasehinde Oluwaseun