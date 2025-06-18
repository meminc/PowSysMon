// src/lib/auth/jwt.js
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Generate access token
export const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn,
        issuer: 'grid-monitoring-api',
        audience: 'grid-monitoring-client'
    });
};

// Generate refresh token
export const generateRefreshToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        issuer: 'grid-monitoring-api',
        audience: 'grid-monitoring-client'
    });
};

// Verify token
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
        issuer: 'grid-monitoring-api',
        audience: 'grid-monitoring-client'
        });
    } catch (error) {
        console.error('Token verification error:', error.message);
        return null;
    }
};

// Generate API key
export const generateApiKey = () => {
    const prefix = 'gm_';
    const randomBytes = crypto.randomBytes(32).toString('base64url');
    return `${prefix}${randomBytes}`;
};

// Hash API key for storage
export const hashApiKey = (apiKey) => {
    const salt = process.env.API_KEY_SALT || 'development-salt';
    return crypto
        .createHash('sha256')
        .update(apiKey + salt)
        .digest('hex');
};

// Extract bearer token from headers
export const extractBearerToken = (authHeader) => {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1];
};

// Generate session ID
export const generateSessionId = () => {
    return crypto.randomBytes(32).toString('hex');
};