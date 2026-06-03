import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { cognitoService } from '../../cognitoService';
import { ShieldCheck, Info } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, signup, confirmSignUp, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'verify'>('login');

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ email: '', password: '', name: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [demoCodeNotice, setDemoCodeNotice] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(loginData.email, loginData.password);
      if (success) {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signup(signupData.email, signupData.password, signupData.name);
      toast.success('Account created! Verification code sent.');
      setVerifyEmail(signupData.email);
      
      // If we are in demo mode, retrieve the code to display a helpful message
      if (cognitoService.isDemoMode) {
        const users = JSON.parse(localStorage.getItem('mock_cognito_users') || '{}');
        const code = users[signupData.email]?.confirmationCode || '123456';
        setDemoCodeNotice(`[DEMO MODE] Verification code generated: ${code}`);
      }
      
      setActiveTab('verify');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await confirmSignUp(verifyEmail, verificationCode);
      toast.success('Email verified successfully! You can now log in.');
      setLoginData({ ...loginData, email: verifyEmail });
      setDemoCodeNotice('');
      setVerificationCode('');
      setActiveTab('login');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      {cognitoService.isDemoMode && (
        <div className="w-full max-w-md mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm flex gap-3 items-start">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Cognito Demo Mode</span>
            Running local User Pool simulation. Set <code className="bg-yellow-500/20 px-1 py-0.5 rounded text-xs">VITE_COGNITO_USER_POOL_ID</code> in <code className="bg-yellow-500/20 px-1 py-0.5 rounded text-xs">.env</code> to connect with your AWS account.
          </div>
        </div>
      )}

      {demoCodeNotice && (
        <div className="w-full max-w-md mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-mono flex gap-3 items-center">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span>{demoCodeNotice}</span>
        </div>
      )}

      <Card className="w-full max-w-md shadow-lg border-muted">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight text-center">
            {activeTab === 'verify' ? 'Verify Your Account' : 'Welcome to your Workspace'}
          </CardTitle>
          <CardDescription className="text-center">
            {activeTab === 'verify' 
              ? `Enter the verification code sent to ${verifyEmail}` 
              : 'Log in or sign up to manage your settings and diary posts.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeTab === 'verify' ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="text-center letter-spacing-widest font-mono text-lg"
                  required
                />
              </div>
              <Button type="submit" className="w-full cursor-pointer" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full cursor-pointer" 
                onClick={() => setActiveTab('signup')}
              >
                Back to Sign Up
              </Button>
            </form>
          ) : (
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="cursor-pointer">Login</TabsTrigger>
                <TabsTrigger value="signup" className="cursor-pointer">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full cursor-pointer" disabled={isLoading}>
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Your name"
                      value={signupData.name}
                      onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="•••••••• (min 6 characters)"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full cursor-pointer" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
