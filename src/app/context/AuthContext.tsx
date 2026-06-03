import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cognitoService } from '../../cognitoService';

interface User {
  email: string;
  name: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  confirmSignUp: (email: string, code: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = cognitoService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const sessionUser = await cognitoService.signIn(email, password);
      setUser(sessionUser);
      return true;
    } catch (err: any) {
      console.error('[AuthContext] Login failed:', err);
      throw err; // Throw to handle display in the UI
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      await cognitoService.signUp(email, password, name);
      return true;
    } catch (err: any) {
      console.error('[AuthContext] Signup failed:', err);
      throw err;
    }
  };

  const confirmSignUp = async (email: string, code: string): Promise<boolean> => {
    try {
      await cognitoService.confirmSignUp(email, code);
      return true;
    } catch (err: any) {
      console.error('[AuthContext] Verification failed:', err);
      throw err;
    }
  };

  const logout = () => {
    cognitoService.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, confirmSignUp, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
