const API_URL = import.meta.env.VITE_API_URL || '';

export const apiService = {
  isConfigured: !!API_URL,

  // 1. FETCH DYNAMODB POSTS
  fetchPosts: async () => {
    if (!API_URL) return [];
    try {
      const res = await fetch(`${API_URL}/posts`);
      if (!res.ok) throw new Error('Failed to fetch posts from API');
      return await res.json();
    } catch (e) {
      console.error('[API ERROR] fetchPosts failed:', e);
      return [];
    }
  },

  // 2. CREATE DYNAMODB POST
  createPost: async (postData, token) => {
    if (!API_URL) throw new Error('API URL is not configured.');
    const authHeader = token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '';
    const res = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(postData)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to publish post.');
    }
    return await res.json();
  },

  // 3. FETCH DYNAMODB COMMENTS
  fetchComments: async (postSlug) => {
    if (!API_URL) return [];
    try {
      const res = await fetch(`${API_URL}/comments?postSlug=${encodeURIComponent(postSlug)}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return await res.json();
    } catch (e) {
      console.error('[API ERROR] fetchComments failed:', e);
      return [];
    }
  },

  // 4. CREATE DYNAMODB COMMENT
  createComment: async (commentData, token) => {
    if (!API_URL) throw new Error('API URL is not configured.');
    
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(commentData)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to submit comment.');
    }
    return await res.json();
  },

  // 5. FETCH UNIQUE FITNESS EXERCISES
  fetchFitnessExercises: async () => {
    if (!API_URL) return [];
    try {
      const res = await fetch(`${API_URL}/fitness`);
      if (!res.ok) throw new Error('Failed to fetch exercises');
      return await res.json();
    } catch (e) {
      console.error('[API ERROR] fetchFitnessExercises failed:', e);
      return [];
    }
  },

  // 6. FETCH FITNESS HISTORY FOR EXERCISE
  fetchFitnessHistory: async (exerciseName) => {
    if (!API_URL) return [];
    const res = await fetch(`${API_URL}/fitness?exercise_name=${encodeURIComponent(exerciseName)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || `Server returned error status ${res.status}`);
    }
    const data = await res.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.error || data.message) {
        throw new Error(data.error || data.message);
      }
    }
    return data;
  },

  // 7. FETCH FITNESS FOR SPECIFIC DATE (ALL EXERCISES)
  fetchFitnessDay: async (date) => {
    if (!API_URL) return [];
    try {
      const res = await fetch(`${API_URL}/fitness?date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error('Failed to fetch fitness day logs');
      return await res.json();
    } catch (e) {
      console.error('[API ERROR] fetchFitnessDay failed:', e);
      return [];
    }
  },

  // 8. CREATE FITNESS LOG
  createFitnessLog: async (fitnessData) => {
    if (!API_URL) throw new Error('API URL is not configured.');
    const res = await fetch(`${API_URL}/fitness`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fitnessData)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Failed to submit fitness log.');
    }
    return await res.json();
  },

  // 9. SYNC RENPHO WEIGHT
  syncRenphoWeight: async () => {
    if (!API_URL) throw new Error('API URL is not configured.');
    const res = await fetch(`${API_URL}/fitness/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Failed to sync Renpho weight.');
    }
    return await res.json();
  }
};
