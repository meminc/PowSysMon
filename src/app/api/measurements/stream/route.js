// src/app/api/measurements/stream/route.js
import { authMiddleware } from '@/lib/auth/middleware';
import { cache } from '@/lib/db/redis';
import { streamResponse } from '@/lib/utils/response';

// Server-Sent Events for real-time data
export const GET = authMiddleware(async (request) => {
  const { searchParams } = new URL(request.url);
  const elementIds = searchParams.get('elements')?.split(',').filter(Boolean) || [];
  
  if (elementIds.length === 0) {
    return new Response('No element IDs provided', { status: 400 });
  }
  
  // Validate element IDs (max 10 for performance)
  if (elementIds.length > 10) {
    return new Response('Maximum 10 elements allowed for streaming', { status: 400 });
  }

  const encoder = new TextEncoder();
  let intervalId;
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ 
          message: 'Connected to measurement stream',
          elements: elementIds 
        })}\n\n`)
      );
      
      // Set up interval to send updates
      intervalId = setInterval(async () => {
        try {
          const data = {};
          const alarms = [];
          
          // Get latest measurements and alarms for each element
          for (const elementId of elementIds) {
            // Get measurements
            const measurements = await cache.get(`measurements:${elementId}:latest`);
            if (measurements) {
              data[elementId] = measurements;
            }
            
            // Check for active alarms
            const keys = await cache.keys(`alarm:${elementId}:*`);
            for (const key of keys) {
              const alarm = await cache.get(key);
              if (alarm) {
                alarms.push(alarm);
              }
            }
          }
          
          // Send measurement data
          if (Object.keys(data).length > 0) {
            const event = `event: measurements\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(event));
          }
          
          // Send alarms if any
          if (alarms.length > 0) {
            const event = `event: alarms\ndata: ${JSON.stringify(alarms)}\n\n`;
            controller.enqueue(encoder.encode(event));
          }
          
          // Send heartbeat
          const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({ 
            timestamp: new Date().toISOString() 
          })}\n\n`;
          controller.enqueue(encoder.encode(heartbeat));
          
        } catch (error) {
          console.error('Stream error:', error);
          const errorEvent = `event: error\ndata: ${JSON.stringify({ 
            error: 'Stream error occurred' 
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
        }
      }, 1000); // Send updates every second
      
      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        controller.close();
      });
    },
    
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    }
  });

  return streamResponse(stream);
});