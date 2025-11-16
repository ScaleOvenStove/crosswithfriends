/**
 * Component test setup file
 * This is imported by Playwright Component Testing before each test
 */
import React from 'react';
import './setup';

// Export a default component wrapper if needed
export const Wrapper = ({children}: {children: React.ReactNode}) => children;
