import { authMiddleware } from '../middleware/auth';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');
jest.mock('../config/environment', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key'
  }
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockSupabase: any;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    
    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockSupabase = {
      auth: {
        getUser: jest.fn()
      }
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  it('should return 401 when no authorization header', async () => {
    await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    
    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({ 
      error: 'Missing or invalid authorization header' 
    });
  });

  it('should return 401 when authorization header does not start with Bearer', async () => {
    mockRequest.headers!.authorization = 'Basic token123';
    
    await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    
    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({ 
      error: 'Missing or invalid authorization header' 
    });
  });

  it('should return 401 when token is invalid', async () => {
    mockRequest.headers!.authorization = 'Bearer invalid-token';
    mockSupabase.auth.getUser.mockResolvedValue({ 
      data: null, 
      error: { message: 'Invalid token' } 
    });
    
    await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    
    expect(mockReply.status).toHaveBeenCalledWith(401);
    expect(mockReply.send).toHaveBeenCalledWith({ 
      error: 'Invalid or expired token' 
    });
  });

  it('should set userId when token is valid', async () => {
    const userId = 'user-123';
    mockRequest.headers!.authorization = 'Bearer valid-token';
    mockSupabase.auth.getUser.mockResolvedValue({ 
      data: { user: { id: userId } }, 
      error: null 
    });
    
    await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
    
    expect(mockRequest.userId).toBe(userId);
    expect(mockReply.status).not.toHaveBeenCalled();
    expect(mockReply.send).not.toHaveBeenCalled();
  });
});