// middleware.js (in project root, same level as package.json)
import { NextResponse } from 'next/server';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const isLoginPage = request.nextUrl.pathname === '/login';
  
  // Public paths that don't require authentication
  const isPublicPath = 
    request.nextUrl.pathname === '/login' || 
    request.nextUrl.pathname.startsWith('/api/auth/login') ||
    request.nextUrl.pathname.startsWith('/api/health') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico');

  // If no token and trying to access protected route
  if (!token && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If has token and trying to access login page
  if (token && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};