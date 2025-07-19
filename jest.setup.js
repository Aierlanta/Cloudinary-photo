import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
process.env.CLOUDINARY_API_KEY = 'test-key'
process.env.CLOUDINARY_API_SECRET = 'test-secret'
process.env.ADMIN_PASSWORD = 'test-password'
process.env.NODE_ENV = 'test'