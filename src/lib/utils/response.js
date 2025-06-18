// src/lib/utils/response.js
import { NextResponse } from 'next/server';

// Success response helpers
export const successResponse = (data, message = 'Success', statusCode = 200) => {
    return NextResponse.json(
        {
        success: true,
        message,
        data
        },
        { status: statusCode }
    );
};

export const createdResponse = (data, message = 'Resource created successfully') => {
    return successResponse(data, message, 201);
};

export const noContentResponse = () => {
    return new NextResponse(null, { status: 204 });
};

// Paginated response
export const paginatedResponse = (data, pagination, statusCode = 200) => {
    return NextResponse.json(
        {
        success: true,
        data,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
            pages: Math.ceil(pagination.total / pagination.limit),
            hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
            hasPrev: pagination.page > 1
        }
        },
        { status: statusCode }
    );
};

// Stream response for Server-Sent Events
export const streamResponse = (stream, headers = {}) => {
    return new Response(stream, {
        headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
        ...headers
        }
    });
};

// File download response
export const fileResponse = (buffer, filename, contentType = 'application/octet-stream') => {
    return new NextResponse(buffer, {
        headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length
        }
    });
};

// CSV response
export const csvResponse = (csvContent, filename = 'export.csv') => {
     return fileResponse(Buffer.from(csvContent, 'utf8'), filename, 'text/csv');
};

// JSON file response
export const jsonFileResponse = (data, filename = 'export.json') => {
    const jsonContent = JSON.stringify(data, null, 2);
    return fileResponse(Buffer.from(jsonContent, 'utf8'), filename, 'application/json');
};

// Add standard headers
export const withHeaders = (response, headers = {}) => {
    const defaultHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    Object.entries({ ...defaultHeaders, ...headers }).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    return response;
};

// Add cache headers
export const withCache = (response, maxAge = 300, sMaxAge = 600) => {
    response.headers.set(
        'Cache-Control',
        `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=60`
    );
    return response;
};

// Add no-cache headers
export const withNoCache = (response) => {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
};

// Rate limit headers
export const withRateLimitHeaders = (response, { limit, remaining, reset }) => {
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());
    return response;
};