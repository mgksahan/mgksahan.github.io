import { 
  CognitoUserPool, 
  CognitoUserAttribute, 
  CognitoUser, 
  AuthenticationDetails 
} from 'amazon-cognito-identity-js';

// Load config from Vite environment variables
const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || ''
};

const isConfigured = poolData.UserPoolId && poolData.ClientId;

// Local Mock Database for Demo Mode
const getMockUsers = () => JSON.parse(localStorage.getItem('mock_cognito_users') || '{}');
const saveMockUsers = (users) => localStorage.setItem('mock_cognito_users', JSON.stringify(users));

export const cognitoService = {
  isDemoMode: !isConfigured,

  // 1. SIGN UP
  signUp: (email, password, name) => {
    if (!isConfigured) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getMockUsers();
          if (users[email]) {
            return reject(new Error('User already exists.'));
          }
          
          // Generate a 6-digit confirmation code
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          
          users[email] = {
            email,
            password,
            name,
            confirmed: false,
            confirmationCode: code
          };
          saveMockUsers(users);
          
          console.log(`[DEMO MODE] Sign up successful for ${email}. Confirmation code is: ${code}`);
          resolve({
            userConfirmed: false,
            user: { email, name }
          });
        }, 800);
      });
    }

    const userPool = new CognitoUserPool(poolData);
    const attributeList = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name })
    ];

    return new Promise((resolve, reject) => {
      userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) return reject(err);
        resolve({
          userConfirmed: result.userConfirmed,
          user: result.user
        });
      });
    });
  },

  // 2. CONFIRM SIGN UP
  confirmSignUp: (email, code) => {
    if (!isConfigured) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getMockUsers();
          const user = users[email];
          if (!user) return reject(new Error('User not found.'));
          
          if (user.confirmationCode === code) {
            user.confirmed = true;
            saveMockUsers(users);
            resolve('SUCCESS');
          } else {
            reject(new Error('Invalid confirmation code.'));
          }
        }, 800);
      });
    }

    const userPool = new CognitoUserPool(poolData);
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  },

  // 3. SIGN IN
  signIn: (email, password) => {
    if (!isConfigured) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getMockUsers();
          const user = users[email];
          
          if (!user || user.password !== password) {
            return reject(new Error('Incorrect username or password.'));
          }
          if (!user.confirmed) {
            return reject(new Error('User is not confirmed. Please enter confirmation code.'));
          }
          
          const sessionUser = { email, name: user.name };
          localStorage.setItem('active_blog_user', JSON.stringify(sessionUser));
          resolve(sessionUser);
        }, 800);
      });
    }

    const userPool = new CognitoUserPool(poolData);
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (result) => {
          const idToken = result.getIdToken().getJwtToken();
          const name = result.getIdToken().payload.name || email;
          const sessionUser = { email, name, token: idToken };
          localStorage.setItem('active_blog_user', JSON.stringify(sessionUser));
          resolve(sessionUser);
        },
        onFailure: (err) => {
          reject(err);
        }
      });
    });
  },

  // 4. SIGN OUT
  signOut: () => {
    localStorage.removeItem('active_blog_user');
    if (!isConfigured) {
      return Promise.resolve();
    }
    const userPool = new CognitoUserPool(poolData);
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    return Promise.resolve();
  },

  // 4.5. FORGOT PASSWORD
  forgotPassword: (email) => {
    if (!isConfigured) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getMockUsers();
          if (!users[email]) {
            return reject(new Error('User not found.'));
          }
          // Generate a 6-digit verification code
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          users[email].resetCode = code;
          saveMockUsers(users);
          
          console.log(`[DEMO MODE] Forgot password code for ${email} is: ${code}`);
          resolve({
            CodeDeliveryDetails: {
              Destination: email,
              DeliveryMedium: 'EMAIL'
            }
          });
        }, 800);
      });
    }

    const userPool = new CognitoUserPool(poolData);
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

    return new Promise((resolve, reject) => {
      cognitoUser.forgotPassword({
        onSuccess: (data) => {
          resolve(data);
        },
        onFailure: (err) => {
          reject(err);
        },
        inputVerificationCode: (data) => {
          resolve(data);
        }
      });
    });
  },

  // 4.6. CONFIRM PASSWORD
  confirmPassword: (email, code, newPassword) => {
    if (!isConfigured) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const users = getMockUsers();
          const user = users[email];
          if (!user) return reject(new Error('User not found.'));
          
          if (user.resetCode === code) {
            user.password = newPassword;
            delete user.resetCode;
            saveMockUsers(users);
            resolve('SUCCESS');
          } else {
            reject(new Error('Invalid verification code.'));
          }
        }, 800);
      });
    }

    const userPool = new CognitoUserPool(poolData);
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve('SUCCESS');
        },
        onFailure: (err) => {
          reject(err);
        }
      });
    });
  },

  getCurrentUser: () => {
    const savedUser = localStorage.getItem('active_blog_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  // BIOMETRIC SUPPORT
  hasBiometrics: () => {
    return !!(localStorage.getItem('bio_cred_id') && localStorage.getItem('bio_session_data'));
  },

  registerBiometrics: async (email, password, name) => {
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Biometrics not supported on this browser.');
      }
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        throw new Error('Biometric hardware not available on this device.');
      }

      const challenge = new Uint8Array(16);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const createOptions = {
        publicKey: {
          challenge: challenge,
          rp: { name: "Sahan's Diary", id: window.location.hostname },
          user: { id: userId, name: email, displayName: name },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000
        }
      };

      const credential = await navigator.credentials.create(createOptions);
      if (!credential) {
        throw new Error('Failed to create credential.');
      }

      const credentialId = btoa(String.fromCharCode.apply(null, new Uint8Array(credential.rawId)));
      localStorage.setItem('bio_cred_id', credentialId);
      localStorage.setItem('bio_session_data', JSON.stringify({ email, password, name }));
      return true;
    } catch (err) {
      console.error('Biometric registration error:', err);
      throw err;
    }
  },

  authenticateBiometrics: async () => {
    try {
      const credentialIdStr = localStorage.getItem('bio_cred_id');
      const sessionDataStr = localStorage.getItem('bio_session_data');
      if (!credentialIdStr || !sessionDataStr) {
        throw new Error('No biometrics registered.');
      }

      const challenge = new Uint8Array(16);
      window.crypto.getRandomValues(challenge);
      const rawId = new Uint8Array(atob(credentialIdStr).split("").map(c => c.charCodeAt(0)));

      const getOptions = {
        publicKey: {
          challenge: challenge,
          rpId: window.location.hostname,
          allowCredentials: [{ id: rawId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000
        }
      };

      const assertion = await navigator.credentials.get(getOptions);
      if (!assertion) {
        throw new Error('Biometric verification failed.');
      }

      return JSON.parse(sessionDataStr);
    } catch (err) {
      console.error('Biometric auth error:', err);
      throw err;
    }
  },

  clearBiometrics: () => {
    localStorage.removeItem('bio_cred_id');
    localStorage.removeItem('bio_session_data');
  }
};
