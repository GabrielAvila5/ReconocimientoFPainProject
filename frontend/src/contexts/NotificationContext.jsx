import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${baseUrl}/api/v1/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    // Inicializar conteo
    fetchUnreadCount();

    // Inicializar Socket.io
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const newSocket = io(baseUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to notification service');
    });

    newSocket.on('new_notification', (notification) => {
      // Incrementar el conteo
      setUnreadCount(prev => prev + 1);

      // Mostrar toast
      const type = notification.type ? notification.type.toLowerCase() : 'info';
      if (toast[type]) {
        toast[type](notification.title, {
          description: notification.message,
        });
      } else {
        toast(notification.title, {
          description: notification.message,
        });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/v1/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Actualizamos el conteo localmente para respuesta inmediata
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/v1/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Deberíamos refetch el count por si la borrada no estaba leída, pero para simplificar
      fetchUnreadCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const deleteReadNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/v1/notifications/read`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error deleting read notifications:', error);
    }
  }

  const refetch = fetchUnreadCount;

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteReadNotifications,
      refetch,
      socket
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
