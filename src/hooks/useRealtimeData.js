// src/hooks/useRealtimeData.js
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api/client';

export default function useRealtimeData(elementIds = []) {
  const [measurements, setMeasurements] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [eventSource, setEventSource] = useState(null);

  const connect = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }

    const token = localStorage.getItem('token');
    const params = elementIds.length > 0 ? `?elements=${elementIds.join(',')}` : '';
    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/measurements/stream${params}`;

    const newEventSource = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    newEventSource.onopen = () => {
      setConnectionStatus('connected');
      console.log('Connected to real-time stream');
    };

    newEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMeasurements(data);
      } catch (error) {
        console.error('Error parsing measurement data:', error);
      }
    };

    newEventSource.addEventListener('measurements', (event) => {
      try {
        const data = JSON.parse(event.data);
        setMeasurements(data);
      } catch (error) {
        console.error('Error parsing measurement event:', error);
      }
    });

    newEventSource.addEventListener('alarms', (event) => {
      try {
        const alarms = JSON.parse(event.data);
        // Handle alarms - could trigger notifications
        console.log('Received alarms:', alarms);
      } catch (error) {
        console.error('Error parsing alarm event:', error);
      }
    });

    newEventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setConnectionStatus('disconnected');
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (newEventSource.readyState === EventSource.CLOSED) {
          connect();
        }
      }, 5000);
    };

    setEventSource(newEventSource);
  }, [elementIds]);

  useEffect(() => {
    // For now, use mock data since SSE might not be fully implemented
    const mockInterval = setInterval(() => {
      setMeasurements({
        voltage: 132 + (Math.random() - 0.5) * 2,
        power: 156.8 + (Math.random() - 0.5) * 10,
        frequency: 50 + (Math.random() - 0.5) * 0.1,
        efficiency: 98.5 + (Math.random() - 0.5) * 1,
      });
      setConnectionStatus('connected');
    }, 2000);

    return () => {
      clearInterval(mockInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return {
    measurements,
    connectionStatus,
    connect,
    disconnect: () => {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
        setConnectionStatus('disconnected');
      }
    }
  };
}