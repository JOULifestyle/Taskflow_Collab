import { useEffect, useState } from "react";
import { useSocket } from "../context/SocketProvider";
import toast from "react-hot-toast";

export const useIOSNotifications = (user) => {
  const { socket } = useSocket();
  const [deviceDetected, setIsIOSDevice] = useState(false);

  useEffect(() => {
    // Check if this is an iOS device
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOSDevice(isIOS);
  }, []);

  useEffect(() => {
    // Only run on iOS devices and when socket is connected
    if (!deviceDetected || !socket || !user) {
      return;
    }

    console.log('[iOS Notifications] Setting up real-time notifications for iOS');

    // Helper function to show toast notification
    const showToast = (message, type = 'default') => {
      const icons = {
        task_created: '📝',
        task_updated: '✏️',
        task_deleted: '🗑️',
        task_reminder: '⏰',
        default: '🔔'
      };

      const icon = icons[type] || icons.default;
      
      toast(message, {
        icon: `${icon}`,
        duration: 4000,
        style: {
          background: '#1f2937',
          color: '#fff',
          border: '1px solid #374151'
        }
      });
    };

    // Listen for task-related events and show iOS notifications
    const handleTaskCreated = (task) => {
      // Don't notify if user created the task themselves
      if (task.userId === user._id) return;
      
      const message = `New task: ${task.text}`;
      console.log('[iOS Notifications] Task created:', message);
      showToast(message, 'task_created');
    };

    const handleTaskUpdated = (task) => {
      // Don't notify if user updated the task themselves
      if (task.userId === user._id) return;
      
      const message = `Task updated: ${task.text}`;
      console.log('[iOS Notifications] Task updated:', message);
      showToast(message, 'task_updated');
    };

    const handleTaskDeleted = (taskData) => {
      // We don't have the full task data for deleted tasks, so use a generic message
      const message = `Task was deleted`;
      console.log('[iOS Notifications] Task deleted:', message);
      showToast(message, 'task_deleted');
    };

    const handleTaskReminder = (data) => {
      const message = data.message || 'Task reminder';
      console.log('[iOS Notifications] Task reminder:', message);
      showToast(message, 'task_reminder');
    };

    // Set up event listeners
    socket.on("task:created", handleTaskCreated);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:deleted", handleTaskDeleted);
    socket.on("task:reminder", handleTaskReminder);

    // Join user-specific room for notifications
    socket.emit("join-user", user._id);

    // Clean up
    return () => {
      socket.off("task:created", handleTaskCreated);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:deleted", handleTaskDeleted);
      socket.off("task:reminder", handleTaskReminder);
      socket.emit("leave-user", user._id);
    };
  }, [socket, user, deviceDetected]);

  return {
    isIOSDevice: deviceDetected,
    // Force show a test notification (useful for debugging)
    showTestNotification: () => {
      if (deviceDetected && socket) {
        toast('📱 iOS notifications working!', {
          icon: '✅',
          duration: 3000
        });
      }
    }
  };
};