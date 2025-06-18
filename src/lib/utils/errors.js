// src/lib/utils/errors.js
import { NextResponse } from 'next/server';

// Base error class
export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
    }
}

// Specific error classes
export class ValidationError extends AppError {
    constructor(errors) {
        super('Validation failed', 400, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409, 'CONFLICT');
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

export class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, 'DATABASE_ERROR');
    }
}

// Global error handler
export const errorHandler = (error) => {
    // Log error details
    console.error('Error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        isOperational: error.isOperational
    });

    // Handle known operational errors
    if (error.isOperational) {
        return NextResponse.json(
        {
            error: {
            message: error.message,
            code: error.code,
            errors: error.errors || undefined
            }
        },
        { status: error.statusCode }
        );
    }

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
        const errors = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
        }));
        
        return NextResponse.json(
        {
            error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors
            }
        },
        { status: 400 }
        );
    }

    // Handle database errors
    if (error.code === '23505') { // PostgreSQL unique violation
        return NextResponse.json(
        {
            error: {
            message: 'Resource already exists',
            code: 'DUPLICATE_ERROR'
            }
        },
        { status: 409 }
        );
    }

    if (error.code === '23503') { // PostgreSQL foreign key violation
        return NextResponse.json(
        {
            error: {
            message: 'Referenced resource does not exist',
            code: 'REFERENCE_ERROR'
            }
        },
        { status: 400 }
        );
    }

    // Default error response for unexpected errors
    return NextResponse.json(
        {
        error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR'
        }
        },
        { status: 500 }
    );
};

// Async error wrapper for route handlers
export const asyncHandler = (fn) => {
    return async (request, context) => {
        try {
            return await fn(request, context);
        } catch (error) {
            return errorHandler(error);
        }
    };
};