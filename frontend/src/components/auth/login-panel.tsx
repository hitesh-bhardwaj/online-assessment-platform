'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Eye, EyeOff } from 'lucide-react';

type LoginMode = 'password' | 'otp';

type PasswordFormValues = {
  email: string;
  password: string;
};

type OtpFormValues = {
  email: string;
  code: string;
};

export function LoginPanel({
  nextRoute: nextRouteProp,
}: {
  nextRoute?: string;
}) {
  const router = useRouter();
  const { login, loginWithOtp, requestOtp, status, defaultRoute } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const nextRoute = nextRouteProp ?? defaultRoute;
  const [tab, setTab] = useState<LoginMode>('password');

  const passwordForm = useForm<PasswordFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const otpForm = useForm<OtpFormValues>({
    defaultValues: {
      email: '',
      code: '',
    },
  });

  const passwordEmail = passwordForm.watch('email');
  const otpEmail = otpForm.watch('email');
  const otpCode = otpForm.watch('code');

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const isOtpComplete = otpForm.watch('code')?.length === 6;

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(nextRoute);
    }
  }, [status, router, nextRoute]);

  useEffect(() => {
    setPasswordError(null);
    setOtpError(null);

    if (tab === 'password') {
      setOtpRequested(false);
      setOtpMessage(null);
      setRequestingOtp(false);
      if (!passwordEmail && otpEmail) {
        passwordForm.setValue('email', otpEmail);
      }
    } else {
      if (!otpEmail && passwordEmail) {
        otpForm.setValue('email', passwordEmail);
      }
    }
  }, [tab, passwordEmail, otpEmail, otpForm, passwordForm]);

  const handlePasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordError(null);
    setPasswordSubmitting(true);

    try {
      await login({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      router.replace(nextRoute);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign in';
      setPasswordError(message);
    } finally {
      setPasswordSubmitting(false);
    }
  });

  const handleRequestOtp = async () => {
    setOtpError(null);
    setOtpMessage(null);

    const isValid = await otpForm.trigger('email');
    if (!isValid) return;

    const email = otpForm.getValues('email').trim().toLowerCase();
    setRequestingOtp(true);
    try {
      const message = await requestOtp(email);
      setOtpMessage(message);
      setOtpRequested(true);
      otpForm.setValue('code', '');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send code';
      setOtpError(message);
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleOtpSubmit = otpForm.handleSubmit(async (values) => {
    if (!otpRequested) {
      setOtpError('Request a code before signing in.');
      return;
    }

    setOtpError(null);
    setOtpSubmitting(true);

    try {
      await loginWithOtp({
        email: values.email.trim().toLowerCase(),
        code: values.code.trim(),
      });
      router.replace(nextRoute);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid or expired code';
      setOtpError(message);
    } finally {
      setOtpSubmitting(false);
    }
  });

  const tabDescription = useMemo(() => {
    if (tab === 'password') {
      return 'Enter your email and password to access your workspace.';
    }
    return 'Receive a one-time code in your inbox and sign in without a password.';
  }, [tab]);

  if (status === 'authenticated') {
    return null;
  }

  return (
    <div className="w-full space-y-6 text-slate-100">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-background">
          Welcome back
        </h1>
        <p className="text-sm text-background">{tabDescription}</p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as LoginMode)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 bg-white/10 text-slate-100 backdrop-blur-sm">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="otp">Email code</TabsTrigger>
        </TabsList>
        <TabsContent value="password">
          <Form {...passwordForm}>
            <form className="space-y-6" onSubmit={handlePasswordSubmit}>
              <FormField
                control={passwordForm.control}
                name="email"
                // rules={{ required: 'Email is required' }}
                rules={{
                  required: 'Email is required',
                  validate: {
                    validEmail: (value) => {
                      const emailRegex =
                        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                      return (
                        emailRegex.test(value) ||
                        'Please enter a valid email address'
                      );
                    },
                    // You can add more custom validations here
                    noDisposable: (value) => {
                      const disposableDomains = [
                        'tempmail.com',
                        'throwaway.email',
                      ];
                      const domain = value.split('@')[1];
                      return (
                        !disposableDomains.includes(domain) ||
                        'Please use a non-disposable email'
                      );
                    },
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="avery@acme.io"
                        className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="password"
                rules={{ required: 'Password is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="bg-white/80 text-slate-900 placeholder:text-slate-500 pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              {passwordError ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to sign in</AlertTitle>
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex items-center justify-end">
                <a
                  href="/forgot-password"
                  className="text-sm text-slate-200 hover:text-white hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={passwordSubmitting}
              >
                {passwordSubmitting ? (
                  <>
                    <LoaderIcon />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Form>
        </TabsContent>
        <TabsContent value="otp">
          <Form {...otpForm}>
            <form className="space-y-6" onSubmit={handleOtpSubmit}>
              <FormField
                control={otpForm.control}
                name="email"
                // rules={{ required: "Email is required" }}
                rules={{
                  required: 'Email is required',
                  validate: {
                    validEmail: (value) => {
                      const emailRegex =
                        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                      return (
                        emailRegex.test(value) ||
                        'Please enter a valid email address'
                      );
                    },
                    // You can add more custom validations here
                    noDisposable: (value) => {
                      const disposableDomains = [
                        'tempmail.com',
                        'throwaway.email',
                      ];
                      const domain = value.split('@')[1];
                      return (
                        !disposableDomains.includes(domain) ||
                        'Please use a non-disposable email'
                      );
                    },
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="avery@acme.io"
                        className="bg-white/80 text-slate-900 placeholder:text-slate-500"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-background">
                      We will send a one-time code to this email address.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-transparent"
                  disabled={requestingOtp}
                  onClick={handleRequestOtp}
                >
                  {requestingOtp ? (
                    <>
                      <LoaderIcon />
                      Sending code…
                    </>
                  ) : (
                    'Send code'
                  )}
                </Button>
                {otpMessage ? (
                  <p className="text-xs text-background/70">{otpMessage}</p>
                ) : null}
              </div>
              <FormField
                control={otpForm.control}
                name="code"
                // rules={{ required: 'Enter the code from your email' }}
                rules={{
                  required: 'Enter the code from your email',
                  minLength: {
                    value: 6,
                    message: 'Code must be 6 digits',
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>One-time code</FormLabel>
                    <FormControl>
                      <InputOTP maxLength={6} {...field} onChange={(value) => {
            // Only allow numbers
            const numericValue = value.replace(/\D/g, '');
            field.onChange(numericValue);
          }}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {otpError ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to sign in</AlertTitle>
                  <AlertDescription>{otpError}</AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={otpSubmitting || !isOtpComplete}
              >
                {otpSubmitting ? (
                  <>
                    <LoaderIcon />
                    Verifying…
                  </>
                ) : (
                  'Sign in with code'
                )}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoaderIcon() {
  return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
}
