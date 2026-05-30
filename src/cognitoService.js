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

  // 5. GET CURRENT USER
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
  }
};
