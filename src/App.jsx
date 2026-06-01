import { useState, useEffect, useRef } from 'react';
import { 
  Sun, 
  Moon, 
  Search, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  BookOpen, 
  Mail, 
  ChevronRight,
  Sparkles,
  User,
  LogOut,
  LogIn,
  Send,
  MessageSquare,
  Lock,
  MailCheck,
  Globe,
  Plus,
  Edit3,
  Eye,
  CheckCircle,
  AlertTriangle,
  X,
  Code,
  Cpu,
  ExternalLink,
  Layers
} from 'lucide-react';
import { getPosts } from './postsLoader';
import { cognitoService } from './cognitoService';
import { apiService } from './apiService';
import { marked } from 'marked';
import './App.css';

const Github = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const Twitter = ({ size = 18 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

function App() {
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activePost, setActivePost] = useState(null);
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'blog', 'fitness', or 'write'
  const [postsLoading, setPostsLoading] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login', 'signup', 'verify'
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  // Auth Form Fields
  const [emailField, setEmailField] = useState('');
  const [passwordField, setPasswordField] = useState('');
  const [nameField, setNameField] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [demoCodeNotice, setDemoCodeNotice] = useState('');

  // Write Article State
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('General');
  const [newPostTags, setNewPostTags] = useState('');
  const [writeError, setWriteError] = useState('');
  const [writeSuccess, setWriteSuccess] = useState('');
  const [writeLoading, setWriteLoading] = useState(false);

  // Comments State
  const [activeComments, setActiveComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentError, setCommentError] = useState('');

  // Fitness Tracker State
  const [fitnessExercises, setFitnessExercises] = useState([]);
  const [selectedFitnessExercise, setSelectedFitnessExercise] = useState('');
  const [fitnessHistory, setFitnessHistory] = useState([]);
  const [selectedFitnessMetric, setSelectedFitnessMetric] = useState('1rem'); // '1rem' or 'volume'
  const [fitnessLoading, setFitnessLoading] = useState(false);
  const [searchExerciseQuery, setSearchExerciseQuery] = useState('');
  const [isExerciseDropdownOpen, setIsExerciseDropdownOpen] = useState(false);
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null);
  const [hoveredPointCoords, setHoveredPointCoords] = useState({ x: 0, y: 0 });

  const dropdownRef = useRef(null);

  useEffect(() => {
    // Initial load
    loadHybridPosts();

    // Check current Cognito user
    setCurrentUser(cognitoService.getCurrentUser());

    // Load fitness exercises
    loadFitnessExercises();

    // Set theme
    const savedTheme = localStorage.getItem('sahan-theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  // HTML5 Canvas Antigravity Interactive Particle Mesh Engine
  useEffect(() => {
    const canvas = document.getElementById('antigravity-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let particles = [];
    let mouse = { x: null, y: null, radius: 160 };
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    
    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    
    // Instantiate background particles
    const particleCount = Math.min(Math.floor((canvas.width * canvas.height) / 14000), 110);
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      const size = Math.random() * 2 + 1.2;
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: size,
        originalSize: size
      });
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const isDark = document.documentElement.classList.contains('dark') || document.documentElement.className === 'dark';
      const pColor = isDark ? 'rgba(244, 244, 245, 0.16)' : 'rgba(9, 9, 11, 0.08)';
      const lColorPrefix = isDark ? '244, 244, 245' : '9, 9, 11';
      
      // Update and draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        
        // Bounce off bounds
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        
        // Mouse gravity interaction (soft repellent physical force)
        if (mouse.x !== null && mouse.y !== null) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            // Push gently away
            p.x += (dx / dist) * force * 1.6;
            p.y += (dy / dist) * force * 1.6;
            p.size = p.originalSize + force * 2.5;
          } else {
            if (p.size > p.originalSize) p.size -= 0.08;
          }
        } else {
          if (p.size > p.originalSize) p.size -= 0.08;
        }
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = pColor;
        ctx.fill();
      });
      
      // Draw elastic webbing links between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 115) {
            const opacity = (1 - (dist / 115)) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${lColorPrefix}, ${opacity})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  // Handle click outside to close fitness dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsExerciseDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch comments when activePost changes
  useEffect(() => {
    if (activePost) {
      loadPostComments(activePost.slug || activePost.id);
    }
  }, [activePost]);

  // Load local Markdown + DynamoDB posts
  const loadHybridPosts = async () => {
    setPostsLoading(true);
    try {
      // 1. Load static posts
      const staticPosts = getPosts();

      // 2. Fetch dynamic posts from AWS DynamoDB
      const dbPosts = await apiService.fetchPosts();

      // 3. Merge both and sort by date descending
      const merged = [...dbPosts, ...staticPosts];
      const sorted = merged.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setPosts(sorted);
    } catch (e) {
      console.error('Error loading hybrid posts:', e);
    } finally {
      setPostsLoading(false);
    }
  };

  // Load comments live from AWS API
  const loadPostComments = async (postSlug) => {
    setCommentsLoading(true);
    setCommentError('');
    try {
      const liveComments = await apiService.fetchComments(postSlug);
      setActiveComments(liveComments);
    } catch (err) {
      setCommentError('Failed to load live comments.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadFitnessExercises = async () => {
    try {
      const exercises = await apiService.fetchFitnessExercises();
      setFitnessExercises(exercises);
      if (exercises.length > 0) {
        // Default to Bench Press or first exercise
        const defaultExercise = exercises.find(e => e.includes('Bench Press')) || exercises[0];
        setSelectedFitnessExercise(defaultExercise);
        loadFitnessHistory(defaultExercise);
      }
    } catch (e) {
      console.error('Error loading fitness exercises:', e);
    }
  };

  const loadFitnessHistory = async (exerciseName) => {
    if (!exerciseName) return;
    setFitnessLoading(true);
    try {
      const history = await apiService.fetchFitnessHistory(exerciseName);
      setFitnessHistory(history);
    } catch (e) {
      console.error('Error loading fitness history:', e);
    } finally {
      setFitnessLoading(false);
    }
  };

  const handleExerciseChange = (exercise) => {
    setSelectedFitnessExercise(exercise);
    setIsExerciseDropdownOpen(false);
    setSearchExerciseQuery('');
    loadFitnessHistory(exercise);
    setHoveredDataPoint(null);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('sahan-theme', newTheme);
    document.documentElement.className = newTheme;
  };

  // Auth Operations
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const user = await cognitoService.signIn(emailField, passwordField);
      setCurrentUser(user);
      setIsAuthModalOpen(false);
      clearAuthForm();
    } catch (err) {
      setAuthError(err.message || 'Login failed.');
      if (err.message.includes('not confirmed')) {
        setAuthTab('verify');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await cognitoService.signUp(emailField, passwordField, nameField);
      
      if (cognitoService.isDemoMode) {
        const users = JSON.parse(localStorage.getItem('mock_cognito_users') || '{}');
        const generatedCode = users[emailField]?.confirmationCode || '123456';
        setDemoCodeNotice(`[DEMO MODE] Verification code generated: ${generatedCode}`);
      }
      
      setAuthSuccess('Account created! Please verify your email.');
      setAuthTab('verify');
    } catch (err) {
      setAuthError(err.message || 'Sign up failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await cognitoService.confirmSignUp(emailField, verificationCode);
      setAuthSuccess('Email verified! You can now log in.');
      setAuthTab('login');
      setDemoCodeNotice('');
      setVerificationCode('');
    } catch (err) {
      setAuthError(err.message || 'Verification failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    cognitoService.signOut();
    setCurrentUser(null);
    if (activeTab === 'write') {
      setActiveTab('blog');
    }
  };

  const clearAuthForm = () => {
    setEmailField('');
    setPasswordField('');
    setNameField('');
    setVerificationCode('');
    setAuthError('');
    setAuthSuccess('');
    setDemoCodeNotice('');
  };

  // Publish Article to AWS DynamoDB
  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim() || !currentUser) return;

    setWriteError('');
    setWriteSuccess('');
    setWriteLoading(true);

    try {
      const postData = {
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        categories: [newPostCategory.trim()],
        tags: newPostTags.split(',').map(tag => tag.trim()).filter(Boolean)
      };

      await apiService.createPost(postData, currentUser.token);
      
      setWriteSuccess('Article published successfully!');
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCategory('General');
      setNewPostTags('');
      
      // Reload posts and redirect to main feed
      await loadHybridPosts();
      setTimeout(() => {
        setWriteSuccess('');
        setActiveTab('blog');
      }, 1500);
    } catch (err) {
      setWriteError(err.message || 'Failed to publish article.');
    } finally {
      setWriteLoading(false);
    }
  };

  // Post Comment to AWS DynamoDB
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activePost) return;

    setCommentError('');
    const postSlug = activePost.slug || activePost.id;

    try {
      const commentData = {
        postSlug,
        text: newCommentText.trim()
      };

      // Pass user token if logged in
      const token = currentUser ? currentUser.token : null;
      await apiService.createComment(commentData, token);

      setNewCommentText('');
      // Reload comments list
      await loadPostComments(postSlug);
    } catch (err) {
      setCommentError(err.message || 'Failed to submit comment.');
    }
  };

  // Categories and tags compilation
  const allCategories = [...new Set(posts.flatMap(p => p.categories))];
  const allTags = [...new Set(posts.flatMap(p => p.tags))];

  // Filtering
  const filteredPosts = posts.filter(post => {
    const matchesSearch = 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag ? post.tags.includes(selectedTag) : true;
    const matchesCategory = selectedCategory ? post.categories.includes(selectedCategory) : true;
    return matchesSearch && matchesTag && matchesCategory;
  });

  return (
    <div className="app-container">
      <canvas id="antigravity-canvas" />
      {/* Dynamic Navigation */}
      <nav className="navbar">
        <div className="nav-logo gradient-text" onClick={() => { setActivePost(null); setActiveTab('home'); }}>
          <Sparkles className="pulse-glow" style={{ color: 'var(--accent-color)' }} />
          Sahan Gamage
        </div>
        
        <div className="nav-actions">
          <button 
            className={`nav-tab-btn ${activeTab === 'home' && !activePost ? 'active' : ''}`}
            onClick={() => { setActiveTab('home'); setActivePost(null); }}
          >
            Home
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'blog' && !activePost ? 'active' : ''}`}
            onClick={() => { setActiveTab('blog'); setActivePost(null); }}
          >
            Blog
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'fitness' && !activePost ? 'active' : ''}`}
            onClick={() => { setActiveTab('fitness'); setActivePost(null); }}
          >
            Fitness Tracker
          </button>

          {/* Conditional Admin Write Tab */}
          {currentUser && (
            <button 
              className={`nav-tab-btn ${activeTab === 'write' && !activePost ? 'active' : ''}`}
              onClick={() => { setActiveTab('write'); setActivePost(null); }}
            >
              <Plus size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Write
            </button>
          )}

          {/* User Sign In / Profile action */}
          {currentUser ? (
            <div className="user-profile-widget glass">
              <User size={14} className="user-icon" />
              <span className="user-name">{currentUser.name.split(' ')[0]}</span>
              <button className="logout-btn" onClick={handleLogout} title="Log Out">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button className="login-nav-btn btn-premium gradient-bg" onClick={() => { clearAuthForm(); setAuthTab('login'); setIsAuthModalOpen(true); }}>
              <LogIn size={14} /> <span>Join Pool</span>
            </button>
          )}
          
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </nav>

      {/* Demo Mode Notification Bar */}
      {cognitoService.isDemoMode && (
        <div className="demo-mode-badge animate-fade-in">
          <Globe size={12} />
          <span><strong>Cognito Demo Mode:</strong> Running local User Pool simulation. Set <code>VITE_COGNITO_USER_POOL_ID</code> in <code>.env</code> to hook up your AWS account!</span>
        </div>
      )}

      {/* Full Post Reader & Immersive Comments */}
      {activePost ? (
        <div className="post-reader-view animate-fade-in">
          <button className="back-btn glass" onClick={() => setActivePost(null)}>
            <ArrowLeft size={18} /> Back to Writings
          </button>

          <article className="post-article glass">
            <header className="post-header">
              {activePost.categories.map(cat => (
                <span key={cat} className="post-category-badge">{cat}</span>
              ))}
              <h1 className="post-title Outfit">{activePost.title}</h1>
              <div className="post-meta">
                <span className="meta-item"><Calendar size={14} /> {activePost.date}</span>
                <span className="meta-item">
                  <Clock size={14} /> {Math.ceil(activePost.content.split(' ').length / 200)} min read
                </span>
                {activePost.authorName && (
                  <span className="meta-item"><User size={14} /> By {activePost.authorName}</span>
                )}
              </div>
            </header>

            <div className="prose markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(activePost.content) }} />

            <footer className="post-footer">
              <div className="post-tags">
                {activePost.tags.map(tag => (
                  <span 
                    key={tag} 
                    className="post-tag-item"
                    onClick={() => {
                      setSelectedTag(tag);
                      setActivePost(null);
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </footer>
          </article>

          {/* Secure Reader Comments Section */}
          <section className="comments-section-container glass animate-slide-up">
            <div className="section-header">
              <MessageSquare size={18} style={{ color: 'var(--accent-color)' }} />
              <h2 className="Outfit">Community Conversations</h2>
              <span className="comment-count">{activeComments.length} Comments</span>
            </div>

            {commentError && <div className="auth-alert error">{commentError}</div>}

            {/* List of Comments */}
            <div className="comments-list">
              {commentsLoading ? (
                <div className="loading-spinner text-center">
                  <div className="spinner"></div>
                  <p>Loading conversation...</p>
                </div>
              ) : activeComments.length > 0 ? (
                activeComments.map((comment) => (
                  <div key={comment.id} className="comment-card glass animate-slide-up">
                    <div className="comment-meta">
                      <div className="avatar-placeholder">
                        {comment.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="author-details">
                        <span className="name">{comment.name}</span>
                        <span className="date">{comment.date}</span>
                      </div>
                    </div>
                    <p className="comment-text">{comment.text}</p>
                  </div>
                ))
              ) : (
                <div className="empty-comments text-center">
                  <MessageSquare size={32} className="text-tertiary" />
                  <p>No comments yet. Be the first to start the discussion!</p>
                </div>
              )}
            </div>

            {/* Post a Comment Block */}
            <div className="comment-editor-block border-top">
              {currentUser ? (
                <form onSubmit={handleAddComment} className="comment-form">
                  <div className="editor-user-info">
                    <div className="avatar-placeholder active">
                      {currentUser.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span>Posting as <strong>{currentUser.name}</strong></span>
                  </div>
                  <textarea 
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Join the discussion, share your thoughts..."
                    className="comment-textarea glass"
                    rows="3"
                    required
                  ></textarea>
                  <button type="submit" className="btn-premium gradient-bg submit-comment-btn">
                    <Send size={14} /> Send Comment
                  </button>
                </form>
              ) : (
                <div className="auth-prompt-box glass">
                  <Lock size={18} className="lock-icon" />
                  <div className="prompt-text">
                    <h4 className="Outfit">Join the conversation</h4>
                    <p>Register or log in via AWS Cognito to ask questions and discuss this topic.</p>
                  </div>
                  <button 
                    onClick={() => { clearAuthForm(); setAuthTab('login'); setIsAuthModalOpen(true); }}
                    className="btn-premium gradient-bg"
                  >
                    Log In / Sign Up
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : activeTab === 'write' && currentUser ? (
        // ✍️ AWS COGNITO RICH MARKDOWN EDITOR & PUBLISHER
        <div className="write-layout-container animate-slide-up">
          <div className="write-header-row">
            <h1 className="Outfit"><Edit3 className="pulse-glow" style={{ color: 'var(--accent-color)' }} /> Publish to AWS DynamoDB</h1>
            <p className="form-subtitle">Create a community post. It will instantly appear on the global Writings Feed.</p>
          </div>

          {writeError && <div className="auth-alert error animate-fade-in">{writeError}</div>}
          {writeSuccess && <div className="auth-alert success animate-fade-in">{writeSuccess}</div>}

          <form onSubmit={handlePublishPost} className="write-form-grid">
            {/* Editor Workspace Panel */}
            <div className="editor-inputs-panel glass">
              <div className="form-group">
                <label htmlFor="post-title">Article Title</label>
                <input 
                  type="text" 
                  id="post-title" 
                  placeholder="The Future of Serverless Architectures" 
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  required
                  className="glass"
                />
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label htmlFor="post-category">Category</label>
                  <input 
                    type="text" 
                    id="post-category" 
                    placeholder="AWS Serverless" 
                    value={newPostCategory}
                    onChange={(e) => setNewPostCategory(e.target.value)}
                    required
                    className="glass"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="post-tags">Tags (comma-separated)</label>
                  <input 
                    type="text" 
                    id="post-tags" 
                    placeholder="aws, serverless, cognito" 
                    value={newPostTags}
                    onChange={(e) => setNewPostTags(e.target.value)}
                    className="glass"
                  />
                </div>
              </div>

              <div className="form-group text-editor-group">
                <label htmlFor="post-content">Body Content (Markdown Supported)</label>
                <textarea 
                  id="post-content" 
                  placeholder="# Hello World!&#10;&#10;Write your post body content here using markdown rules..." 
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  required
                  className="glass text-editor-area"
                  rows="12"
                ></textarea>
              </div>

              <button type="submit" disabled={writeLoading} className="btn-premium gradient-bg publish-btn">
                {writeLoading ? 'Publishing to DynamoDB...' : 'Publish Article'}
              </button>
            </div>

            {/* Live Visual Render Preview Panel */}
            <div className="editor-preview-panel glass">
              <div className="preview-header">
                <Eye size={16} /> 
                <span className="Outfit">LIVE RENDER PREVIEW</span>
              </div>
              <div className="preview-scroll-container">
                <div className="post-article preview-content">
                  <header className="post-header">
                    <span className="post-category-badge">{newPostCategory || 'Category'}</span>
                    <h1 className="post-title Outfit">{newPostTitle || 'Title Placeholder'}</h1>
                    <div className="post-meta">
                      <span className="meta-item"><Calendar size={14} /> Today</span>
                      <span className="meta-item"><Clock size={14} /> 1 min read</span>
                      <span className="meta-item"><User size={14} /> {currentUser.name}</span>
                    </div>
                  </header>
                  <div 
                    className="prose markdown-body preview-body" 
                    dangerouslySetInnerHTML={{ 
                      __html: newPostContent.trim() 
                        ? marked.parse(newPostContent) 
                        : '<p class="text-tertiary">Begin typing in the editor on the left to see your beautifully formatted post render live here...</p>' 
                    }} 
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : activeTab === 'fitness' ? (
        <div className="fitness-layout-container animate-slide-up">
          <header className="fitness-header-row">
            <h1 className="Outfit">
              <span className="gradient-text">Fitness Tracker Visualizer</span>
            </h1>
            <p className="fitness-subtitle">
              Interactive historical visualizer of personal workouts parsed directly from Jefit backups.
            </p>
          </header>

          <div className="fitness-controls-row">
            {/* Searchable Exercise Dropdown Selector */}
            <div className="fitness-selector-container">
              <label className="fitness-label">Select Exercise</label>
              <div className="searchable-select-wrapper" ref={dropdownRef}>
                <button 
                  className="searchable-select-trigger glass" 
                  onClick={() => setIsExerciseDropdownOpen(!isExerciseDropdownOpen)}
                  type="button"
                >
                  <Search size={14} className="select-search-icon" />
                  <span>{selectedFitnessExercise || 'Choose an exercise...'}</span>
                  <ChevronRight size={16} className={`select-chevron ${isExerciseDropdownOpen ? 'open' : ''}`} />
                </button>

                {isExerciseDropdownOpen && (
                  <div className="searchable-select-dropdown glass animate-slide-up">
                    <div className="dropdown-search-box">
                      <Search size={12} className="inner-search-icon" />
                      <input 
                        type="text" 
                        placeholder="Search exercise..." 
                        value={searchExerciseQuery}
                        onChange={(e) => setSearchExerciseQuery(e.target.value)}
                        className="dropdown-search-input"
                        autoFocus
                      />
                    </div>
                    <div className="dropdown-options-list">
                      {fitnessExercises.filter(ex => 
                        ex.toLowerCase().includes(searchExerciseQuery.toLowerCase())
                      ).length > 0 ? (
                        fitnessExercises.filter(ex => 
                          ex.toLowerCase().includes(searchExerciseQuery.toLowerCase())
                        ).map(ex => (
                          <button 
                            key={ex}
                            className={`dropdown-option-btn ${selectedFitnessExercise === ex ? 'active' : ''}`}
                            onClick={() => handleExerciseChange(ex)}
                            type="button"
                          >
                            {ex}
                          </button>
                        ))
                      ) : (
                        <div className="dropdown-no-results">No exercises found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Metric Toggle Buttons */}
            <div className="fitness-metric-container">
              <label className="fitness-label">Analyze Metric</label>
              <div className="metric-toggle-group glass">
                <button 
                  className={`metric-toggle-btn ${selectedFitnessMetric === '1rem' ? 'active' : ''}`}
                  onClick={() => setSelectedFitnessMetric('1rem')}
                  type="button"
                >
                  1-Rep Max (lbs)
                </button>
                <button 
                  className={`metric-toggle-btn ${selectedFitnessMetric === 'volume' ? 'active' : ''}`}
                  onClick={() => setSelectedFitnessMetric('volume')}
                  type="button"
                >
                  Total Volume (lbs)
                </button>
              </div>
            </div>
          </div>

          {/* SVG Visualizer Chart */}
          {(() => {
            const chartData = [...fitnessHistory]
              .sort((a, b) => new Date(a.workout_date) - new Date(b.workout_date))
              .map(item => ({
                date: item.workout_date,
                value: selectedFitnessMetric === '1rem' ? item.one_rep_max_lbs : item.total_volume_lbs,
                raw_logs: item.raw_logs
              }))
              .filter(item => item.value !== undefined && item.value !== null);

            const padding = { top: 45, right: 30, bottom: 45, left: 65 };
            
            let getX = (t) => 0;
            let getY = (v) => 0;
            let yTicks = [];
            let xTicks = [];
            let pathD = '';
            let areaD = '';

            if (chartData.length > 0) {
              const timestamps = chartData.map(d => new Date(d.date).getTime());
              const minX = Math.min(...timestamps);
              const maxX = Math.max(...timestamps);
              
              if (maxX > minX) {
                getX = (t) => padding.left + ((t - minX) / (maxX - minX)) * (800 - padding.left - padding.right);
              } else {
                getX = (t) => (800 - padding.left - padding.right) / 2 + padding.left;
              }

              const values = chartData.map(d => d.value);
              const minYVal = Math.min(...values);
              const maxYVal = Math.max(...values);
              const yBuffer = (maxYVal - minYVal) * 0.15 || 10;
              const minY = Math.max(0, minYVal - yBuffer);
              const maxY = maxYVal + yBuffer;

              if (maxY > minY) {
                getY = (v) => 400 - padding.bottom - ((v - minY) / (maxY - minY)) * (400 - padding.top - padding.bottom);
              } else {
                getY = (v) => (400 - padding.top - padding.bottom) / 2 + padding.top;
              }

              // Y ticks
              const yTicksCount = 5;
              yTicks = Array.from({ length: yTicksCount }, (_, i) => {
                return minY + (i * (maxY - minY)) / (yTicksCount - 1);
              });

              // X ticks (evenly spaced chronological date points)
              const xTicksCount = Math.min(chartData.length, 5);
              xTicks = Array.from({ length: xTicksCount }, (_, i) => {
                const idx = Math.round((i * (chartData.length - 1)) / (xTicksCount - 1));
                return chartData[idx];
              }).filter((item, index, self) => self.findIndex(t => t.date === item.date) === index); // deduplicate

              // Path strings
              if (chartData.length > 1) {
                const pathPoints = chartData.map(d => `${getX(new Date(d.date).getTime())},${getY(d.value)}`);
                pathD = `M ${pathPoints.join(' L ')}`;
                areaD = `${pathD} L ${getX(new Date(chartData[chartData.length - 1].date).getTime())},${400 - padding.bottom} L ${getX(new Date(chartData[0].date).getTime())},${400 - padding.bottom} Z`;
              }
            }

            const formatShortDate = (dateStr) => {
              try {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const m = parseInt(parts[1], 10) - 1;
                  const d = parseInt(parts[2], 10);
                  return `${months[m]} ${d}`;
                }
                return dateStr;
              } catch (e) {
                return dateStr;
              }
            };

            const formatFullDate = (dateStr) => {
              try {
                const date = new Date(dateStr + 'T00:00:00');
                return date.toLocaleDateString(undefined, { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
              } catch (e) {
                return dateStr;
              }
            };

            const handlePointHover = (dataPoint, cx, cy) => {
              setHoveredDataPoint(dataPoint);
              setHoveredPointCoords({ x: cx, y: cy });
            };

            const handlePointLeave = () => {
              setHoveredDataPoint(null);
            };

            return (
              <div className="fitness-chart-card glass">
                <div className="chart-header-info">
                  <h3 className="Outfit">{selectedFitnessExercise || 'Exercise'} Progress</h3>
                  <span className="chart-subtitle">
                    Chronological tracking of {selectedFitnessMetric === '1rem' ? 'Estimated 1-Rep Max (lbs)' : 'Total Volume (lbs)'}
                  </span>
                </div>
                
                {fitnessLoading ? (
                  <div className="loading-spinner text-center" style={{ minHeight: '300px' }}>
                    <div className="spinner"></div>
                    <p>Fetching history from AWS DynamoDB...</p>
                  </div>
                ) : chartData.length > 0 ? (
                  <div className="fitness-chart-wrapper" style={{ position: 'relative' }}>
                    <svg 
                      viewBox="0 0 800 400" 
                      className="fitness-svg-chart"
                      width="100%" 
                      height="100%"
                    >
                      <defs>
                        <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.00" />
                        </linearGradient>
                        <linearGradient id="chartLineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--accent-color)" />
                          <stop offset="100%" stopColor="#f472b6" />
                        </linearGradient>
                      </defs>
                      
                      {/* Horizontal Grid lines */}
                      {yTicks.map((tickVal, index) => {
                        const y = getY(tickVal);
                        return (
                          <g key={index} className="chart-grid-line-group">
                            <line 
                              x1={padding.left} 
                              y1={y} 
                              x2={800 - padding.right} 
                              y2={y} 
                              className="chart-grid-line"
                            />
                            <text 
                              x={padding.left - 12} 
                              y={y + 4} 
                              className="chart-axis-label y-label"
                              textAnchor="end"
                            >
                              {Math.round(tickVal)}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* Vertical Grid lines */}
                      {xTicks.map((tickPoint, index) => {
                        const t = new Date(tickPoint.date).getTime();
                        const x = getX(t);
                        return (
                          <g key={index} className="chart-grid-line-group">
                            <line 
                              x1={x} 
                              y1={padding.top} 
                              x2={x} 
                              y2={400 - padding.bottom} 
                              className="chart-grid-line vertical"
                            />
                            <text 
                              x={x} 
                              y={400 - padding.bottom + 20} 
                              className="chart-axis-label x-label"
                              textAnchor="middle"
                            >
                              {formatShortDate(tickPoint.date)}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* Axis Borders */}
                      <line 
                        x1={padding.left} 
                        y1={padding.top} 
                        x2={padding.left} 
                        y2={400 - padding.bottom} 
                        className="chart-border-line"
                      />
                      <line 
                        x1={padding.left} 
                        y1={400 - padding.bottom} 
                        x2={800 - padding.right} 
                        y2={400 - padding.bottom} 
                        className="chart-border-line"
                      />
                      
                      {/* Line/Area plots */}
                      {chartData.length > 1 ? (
                        <>
                          <path d={areaD} className="chart-area-path" fill="url(#chartAreaGradient)" />
                          <path d={pathD} className="chart-line-path" stroke="url(#chartLineGradient)" fill="none" strokeWidth="3" />
                        </>
                      ) : null}
                      
                      {/* Hover nodes */}
                      {chartData.map((d, index) => {
                        const t = new Date(d.date).getTime();
                        const cx = getX(t);
                        const cy = getY(d.value);
                        const isHovered = hoveredDataPoint && hoveredDataPoint.date === d.date;
                        
                        return (
                          <g key={index}>
                            {isHovered && (
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r={12} 
                                className="chart-point-ring" 
                              />
                            )}
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={isHovered ? 6 : 4} 
                              className={`chart-point-dot ${isHovered ? 'hovered' : ''}`}
                            />
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={22} 
                              className="chart-hit-box"
                              onMouseEnter={() => handlePointHover(d, cx, cy)}
                              onMouseLeave={handlePointLeave}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {/* Tooltip component */}
                    {hoveredDataPoint && (
                      <div 
                        className="chart-tooltip glass animate-fade-in"
                        style={{
                          position: 'absolute',
                          left: `${(hoveredPointCoords.x / 800) * 100}%`,
                          top: `${(hoveredPointCoords.y / 400) * 100}%`,
                          transform: 'translate(-50%, -108%)',
                          pointerEvents: 'none',
                          zIndex: 100
                        }}
                      >
                        <div className="tooltip-date">{formatFullDate(hoveredDataPoint.date)}</div>
                        <div className="tooltip-metric">
                          <span className="tooltip-metric-label">
                            {selectedFitnessMetric === '1rem' ? '1-Rep Max' : 'Total Volume'}:
                          </span>
                          <span className="tooltip-metric-value">
                            {hoveredDataPoint.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} lbs
                          </span>
                        </div>
                        
                        <div className="tooltip-logs-container">
                          <div className="tooltip-logs-title">Workout Sets (Weight × Reps):</div>
                          <div className="tooltip-logs-list">
                            {hoveredDataPoint.raw_logs.split(',').map((setStr, sIdx) => {
                              const [weight, reps] = setStr.split('x');
                              const weightLbs = (parseFloat(weight) * 2.20462).toFixed(1);
                              return (
                                <span key={sIdx} className="tooltip-log-pill">
                                  {weightLbs} lbs × {reps}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="empty-results glass" style={{ minHeight: '300px' }}>
                    <BookOpen size={48} className="empty-icon text-tertiary" />
                    <h3 className="Outfit">No data found</h3>
                    <p>No workout records exist for this exercise yet.</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : activeTab === 'blog' ? (
        // CLEAN MINIMALIST BLOG WRITINGS VIEW
        <div className="blog-wrapper animate-slide-up">
          {/* Clean Blog Header */}
          <div className="portfolio-section-block">
            <div className="portfolio-section-header" style={{ marginBottom: '12px' }}>
              <BookOpen className="portfolio-section-icon" size={18} />
              <h2 className="Outfit">Writings & Technical Brainstorms</h2>
            </div>
          </div>

          <div className="blog-layout-container">
            {/* Minimal Search & Filter Bar */}
            <aside className="blog-filters-sidebar">
              <div className="search-box-wrapper glass">
                <Search className="search-icon" size={18} />
                <input 
                  type="text" 
                  placeholder="Search writings..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="filter-group glass">
                <h3 className="Outfit">Categories</h3>
                <div className="filter-options">
                  <button 
                    className={`filter-btn ${selectedCategory === null ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(null)}
                  >
                    All Categories
                  </button>
                  {allCategories.map(cat => (
                    <button 
                      key={cat} 
                      className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group glass">
                <h3 className="Outfit">Tags</h3>
                <div className="tag-cloud">
                  <button 
                    className={`tag-btn ${selectedTag === null ? 'active' : ''}`}
                    onClick={() => setSelectedTag(null)}
                  >
                    All Tags
                  </button>
                  {allTags.map(tag => (
                    <button 
                      key={tag} 
                      className={`tag-btn ${selectedTag === tag ? 'active' : ''}`}
                      onClick={() => setSelectedTag(tag)}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* List of articles */}
            <main className="blog-main-content">
              <div className="results-info">
                Showing {filteredPosts.length} of {posts.length} articles
                {(selectedCategory || selectedTag || searchQuery) && (
                  <button 
                    className="clear-filters-btn" 
                    onClick={() => { setSelectedCategory(null); setSelectedTag(null); setSearchQuery(''); }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="posts-grid-list">
                {postsLoading ? (
                  <div className="loading-spinner text-center glass" style={{ padding: '60px 20px' }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '16px' }}>Fetching feed from AWS DynamoDB...</p>
                  </div>
                ) : filteredPosts.length > 0 ? (
                  filteredPosts.map(post => (
                    <article 
                      key={post.slug || post.id} 
                      className="blog-post-card glass glass-hover animate-slide-up"
                      onClick={() => setActivePost(post)}
                    >
                      <div className="card-header">
                        <span className="post-date"><Calendar size={12} /> {post.date}</span>
                        <span className="post-reading-time">
                          <Clock size={12} /> {Math.ceil(post.content.split(' ').length / 200)} min read
                        </span>
                        {post.authorName && (
                          <span className="post-author"><User size={12} /> {post.authorName}</span>
                        )}
                      </div>

                      <h2 className="post-title Outfit">{post.title}</h2>
                      
                      <p className="post-excerpt">
                        {post.content.replace(/[#*`]/g, '').slice(0, 180)}...
                      </p>

                      <div className="card-footer">
                        <div className="categories-list">
                          {post.categories.map(cat => (
                            <span key={cat} className="category-badge">{cat}</span>
                          ))}
                        </div>
                        <span className="read-action">
                          Read Article <ChevronRight size={16} />
                        </span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-results glass">
                    <BookOpen size={48} className="empty-icon text-tertiary" />
                    <h3 className="Outfit">No articles found</h3>
                    <p>Try clearing your search query or selecting a different category/tag.</p>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      ) : (
        // RESUME-EY PORTFOLIO LANDING PAGE
        <div className="resume-section-container animate-slide-up">
          {/* Elegant Antigravity Portfolio Hero */}
          <section className="portfolio-hero-container glass pulse-glow">
            <div className="hero-profile-meta-row">
              <div className="hero-profile-meta">
                <img 
                  src="https://avatars.githubusercontent.com/u/50710155?v=4" 
                  alt="Sahan Gamage" 
                  className="hero-avatar"
                />
                <div className="hero-title-area text-left">
                  <h1 className="Outfit">Sahan Gamage</h1>
                  <div className="hero-role">Principal Researcher & Systems Architect</div>
                </div>
              </div>
            </div>
            
            <p className="hero-bio text-left">
              Computer Scientist specializing in distributed systems, high-performance virtualization architectures, and integrated radar sensing.
              Designing physical hardware systems, firmware designs, and serverless applications at the intersection of bits and atoms.
            </p>
            
            <div className="hero-meta-badges">
              <span className="hero-badge-pill">#SystemsResearch</span>
              <span className="hero-badge-pill">#IoTArchitect</span>
              <span className="hero-badge-pill">#CloudComputing</span>
              <span className="hero-badge-pill">#EmbeddedHardware</span>
              <span className="hero-badge-pill">#LeuvenBelgium</span>
            </div>

            <div className="hero-cta-row">
              <button onClick={() => { setActiveTab('blog'); window.scrollTo(0,0); }} className="btn-premium btn-cta-primary">
                Explore Blog <BookOpen size={14} style={{ marginLeft: '4px' }} />
              </button>
              <button onClick={() => { setActiveTab('fitness'); window.scrollTo(0,0); }} className="btn-premium btn-cta-secondary">
                Fitness Tracker Visualizer <ChevronRight size={14} />
              </button>
            </div>

            <div className="profile-socials">
              <a href="https://github.com/mgksahan" target="_blank" rel="noreferrer" className="social-badge glass">
                <Github size={14} /> <span>GitHub</span>
              </a>
              <a href="https://twitter.com/mgksahan" target="_blank" rel="noreferrer" className="social-badge glass">
                <Twitter size={14} /> <span>Twitter</span>
              </a>
              <a href="mailto:mgk.sahan@gmail.com" className="social-badge glass">
                <Mail size={14} /> <span>Email</span>
              </a>
            </div>
          </section>

          {/* About Section */}
          <section className="portfolio-section-block">
            <div className="portfolio-section-header">
              <User className="portfolio-section-icon" size={18} />
              <h2 className="Outfit">About Me</h2>
            </div>
            <p className="resume-about-text">
              I am a systems researcher and computer scientist with over 15 years of experience spanning industrial research labs, academic environments, and open-source system software development. I hold a Ph.D. in Computer Science from Purdue University, where I pioneered VM network optimizations in cloud computing environments.
              <br/><br/>
              Currently, my work focuses on physical computing, hardware-software co-design, radar sensing systems, and serverless architectures. I am deeply interested in bridging high-level software paradigms with physical hardware components, creating highly integrated IoT systems, and designing elegant data-driven pipelines.
            </p>
          </section>

          {/* Experience Section (Timeline) */}
          <section className="portfolio-section-block">
            <div className="portfolio-section-header">
              <Layers className="portfolio-section-icon" size={18} />
              <h2 className="Outfit">Professional Experience</h2>
            </div>
            
            <div className="resume-timeline">
              {/* imec */}
              <div className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-header">
                  <div className="timeline-title-row">
                    <span className="timeline-title">Principal Member of Technical Staff</span>
                    <span className="timeline-company">imec</span>
                  </div>
                  <span className="timeline-date">Leuven, Belgium | Present</span>
                </div>
                <p className="timeline-description">
                  Driving research on advanced RF systems, integrated radar sensing, joint kinematics monitoring, and high-performance hardware/circuit implementations.
                </p>
              </div>

              {/* Arm Research */}
              <div className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-header">
                  <div className="timeline-title-row">
                    <span className="timeline-title">Staff Research Engineer</span>
                    <span className="timeline-company">Arm Research</span>
                  </div>
                  <span className="timeline-date">Cambridge, UK</span>
                </div>
                <p className="timeline-description">
                  Led research on ultra-efficient embedded processors, low-power digital designs, and hardware architectures. Supervised doctoral researchers at the University of Cambridge and established academic collaborations.
                </p>
              </div>

              {/* VMware Research */}
              <div className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-header">
                  <div className="timeline-title-row">
                    <span className="timeline-title">Senior Researcher / MTS</span>
                    <span className="timeline-company">VMware Research</span>
                  </div>
                  <span className="timeline-date">2016 – 2023</span>
                </div>
                <p className="timeline-description">
                  Specialized in improving VM I/O scheduling, hypervisor virtualization scale, and distributed cluster managers. Co-developed <strong>Declarative Cluster Managers (DCM)</strong>, utilizing SQL technologies to solve highly complex resource assignment problems at scale.
                </p>
              </div>

              {/* WSO2 */}
              <div className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-header">
                  <div className="timeline-title-row">
                    <span className="timeline-title">Senior Software Engineer</span>
                    <span className="timeline-company">WSO2 Inc.</span>
                  </div>
                  <span className="timeline-date">Sri Lanka</span>
                </div>
                <p className="timeline-description">
                  Architected high-throughput SOA integration middleware. Contributed actively to Apache Software Foundation open-source projects including <strong>Apache Sandesha2/C</strong>, a high-performance WS-ReliableMessaging implementation in C.
                </p>
              </div>

              {/* Millennium IT */}
              <div className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-header">
                  <div className="timeline-title-row">
                    <span className="timeline-title">Software Engineer</span>
                    <span className="timeline-company">Millennium Information Technologies</span>
                  </div>
                  <span className="timeline-date">Sri Lanka</span>
                </div>
                <p className="timeline-description">
                  Designed low-latency execution engines, order book matchers, and high-performance backend components for global financial exchange trading desks.
                </p>
              </div>
            </div>
          </section>

          {/* Education Section */}
          <section className="portfolio-section-block">
            <div className="portfolio-section-header">
              <BookOpen className="portfolio-section-icon" size={18} />
              <h2 className="Outfit">Education</h2>
            </div>
            
            <div className="resume-timeline">
              <div className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-header">
                  <div className="timeline-title-row">
                    <span className="timeline-title">Ph.D. in Computer Science</span>
                    <span className="timeline-company">Purdue University</span>
                  </div>
                  <span className="timeline-date">West Lafayette, IN, USA | 2013</span>
                </div>
                <p className="timeline-description">
                  Research focused on Cloud Computing, Hypervisors, and TCP performance in consolidated virtualization data centers. Developed <strong>vSnoop</strong> and <strong>vFlood</strong> systems, which successfully mitigated consolidated VM delays and optimized TCP throughput.
                </p>
              </div>
            </div>
          </section>

          {/* Projects Section */}
          <section className="portfolio-section-block">
            <div className="portfolio-section-header">
              <Cpu className="portfolio-section-icon" size={18} />
              <h2 className="Outfit">Featured Engineering Projects</h2>
            </div>
            
            <div className="projects-showcase-grid">
              {/* Card 1: Bar Speed Tracker */}
              <div className="project-card-premium glass glass-hover">
                <div className="project-header-row">
                  <span className="project-tag-pill">IoT & Embedded</span>
                  <Code size={16} className="text-secondary" />
                </div>
                <h3 className="project-title-premium Outfit">Bar Speed Tracker</h3>
                <p className="project-desc-premium">
                  An IoT barbell velocity tracker built on an ESP32 and M5StickC Plus2. Measures joint kinematics and lift velocities in real-time, sending logs directly to an AWS database.
                </p>
                <div className="project-action-link" onClick={() => {
                  const post = posts.find(p => p.slug.includes('Bar-Speed-Tracker-Project-Inception') || p.title.toLowerCase().includes('bar speed'));
                  if (post) setActivePost(post);
                  else { setActiveTab('blog'); window.scrollTo(0,0); }
                }}>
                  Read Inception Blog <ChevronRight size={14} />
                </div>
              </div>

              {/* Card 2: Fitness Visualizer */}
              <div className="project-card-premium glass glass-hover">
                <div className="project-header-row">
                  <span className="project-tag-pill">Cloud & Web</span>
                  <Layers size={16} className="text-secondary" />
                </div>
                <h3 className="project-title-premium Outfit">Fitness Tracker Visualizer</h3>
                <p className="project-desc-premium">
                  Interactive progression engine parsing personal workouts directly from Jefit backups. Built as a secure serverless cloud application backed by AWS DynamoDB, Cognito, and API Gateway.
                </p>
                <div className="project-action-link" onClick={() => { setActiveTab('fitness'); window.scrollTo(0,0); }}>
                  Launch Interactive Chart <ChevronRight size={14} />
                </div>
              </div>

              {/* Card 3: Embedded GIF Converter */}
              <div className="project-card-premium glass glass-hover">
                <div className="project-header-row">
                  <span className="project-tag-pill">Embedded Tooling</span>
                  <Cpu size={16} className="text-secondary" />
                </div>
                <h3 className="project-title-premium Outfit">Splash Screen Header Tool</h3>
                <p className="project-desc-premium">
                  A custom, high-speed graphics converter tool designed for embedded displays. Optimizes storage efficiency on the M5Stick display by generating pixel-update-only C++ array frames.
                </p>
                <div className="project-action-link" onClick={() => {
                  const post = posts.find(p => p.slug.includes('Splash-Screen-for-M5-Stick') || p.title.toLowerCase().includes('splash screen'));
                  if (post) setActivePost(post);
                  else { setActiveTab('blog'); window.scrollTo(0,0); }
                }}>
                  Read Diary Log <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </section>

          {/* Technical Competency DNA */}
          <section className="portfolio-section-block">
            <div className="portfolio-section-header">
              <Layers className="portfolio-section-icon" size={18} />
              <h2 className="Outfit">Systems & Hardware DNA</h2>
            </div>
            
            <div className="skills-board-premium">
              <div className="skills-category-premium glass">
                <h3 className="Outfit">IoT & Firmware</h3>
                <div className="skills-tags-row">
                  <span className="skill-tag-item">ESP32 & M5StickC</span>
                  <span className="skill-tag-item">C / C++ Programming</span>
                  <span className="skill-tag-item">Firmware Hacking</span>
                  <span className="skill-tag-item">Sensor Integration</span>
                  <span className="skill-tag-item">Accelerometer Physics</span>
                </div>
              </div>

              <div className="skills-category-premium glass">
                <h3 className="Outfit">Cloud & Serverless</h3>
                <div className="skills-tags-row">
                  <span className="skill-tag-item">AWS DynamoDB</span>
                  <span className="skill-tag-item">AWS Cognito Auth</span>
                  <span className="skill-tag-item">AWS API Gateway</span>
                  <span className="skill-tag-item">React & Javascript</span>
                  <span className="skill-tag-item">REST API Architectures</span>
                </div>
              </div>

              <div className="skills-category-premium glass">
                <h3 className="Outfit">Systems & Research</h3>
                <div className="skills-tags-row">
                  <span className="skill-tag-item">VM I/O Virtualization</span>
                  <span className="skill-tag-item">TCP Optimization</span>
                  <span className="skill-tag-item">Distributed Systems</span>
                  <span className="skill-tag-item">Cloud Scheduling</span>
                  <span className="skill-tag-item">Linux Systems</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Cognito Auth Interactive Modal */}
      {isAuthModalOpen && (
        <div className="auth-modal-overlay animate-fade-in">
          <div className="auth-modal-card glass animate-slide-up">
            <button className="close-modal-btn glass" onClick={() => setIsAuthModalOpen(false)}>
              <X size={16} />
            </button>

            {/* Modal Navigation Tabs */}
            {authTab !== 'verify' && (
              <div className="auth-modal-tabs">
                <button 
                  className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
                  onClick={() => { setAuthError(''); setAuthSuccess(''); setAuthTab('login'); }}
                >
                  Log In
                </button>
                <button 
                  className={`auth-tab-btn ${authTab === 'signup' ? 'active' : ''}`}
                  onClick={() => { setAuthError(''); setAuthSuccess(''); setAuthTab('signup'); }}
                >
                  Create Pool Account
                </button>
              </div>
            )}

            {/* Banner info */}
            {authError && <div className="auth-alert error">{authError}</div>}
            {authSuccess && <div className="auth-alert success">{authSuccess}</div>}
            {demoCodeNotice && <div className="auth-alert demo-info">{demoCodeNotice}</div>}

            {/* TAB 1: LOG IN */}
            {authTab === 'login' && (
              <form onSubmit={handleLogin} className="auth-form">
                <div className="form-title Outfit">Welcome back!</div>
                <p className="form-subtitle">Securely authenticate via AWS Cognito</p>

                <div className="form-group">
                  <label htmlFor="login-email">Email Address</label>
                  <input 
                    type="email" 
                    id="login-email" 
                    placeholder="sahan@example.com" 
                    value={emailField}
                    onChange={(e) => setEmailField(e.target.value)}
                    required
                    className="glass"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="login-password">Password</label>
                  <input 
                    type="password" 
                    id="login-password" 
                    placeholder="••••••••" 
                    value={passwordField}
                    onChange={(e) => setPasswordField(e.target.value)}
                    required
                    className="glass"
                  />
                </div>

                <button type="submit" disabled={authLoading} className="btn-premium gradient-bg btn-submit">
                  {authLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* TAB 2: SIGN UP */}
            {authTab === 'signup' && (
              <form onSubmit={handleSignUp} className="auth-form">
                <div className="form-title Outfit">Create Account</div>
                <p className="form-subtitle">Register into AWS Cognito User Pool</p>

                <div className="form-group">
                  <label htmlFor="signup-name">Full Name</label>
                  <input 
                    type="text" 
                    id="signup-name" 
                    placeholder="Sahan Gamage" 
                    value={nameField}
                    onChange={(e) => setNameField(e.target.value)}
                    required
                    className="glass"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="signup-email">Email Address</label>
                  <input 
                    type="email" 
                    id="signup-email" 
                    placeholder="sahan@example.com" 
                    value={emailField}
                    onChange={(e) => setEmailField(e.target.value)}
                    required
                    className="glass"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="signup-password">Password</label>
                  <input 
                    type="password" 
                    id="signup-password" 
                    placeholder="••••••••" 
                    value={passwordField}
                    onChange={(e) => setPasswordField(e.target.value)}
                    required
                    className="glass"
                  />
                  <span className="password-instruction">Must be at least 8 characters with numbers and symbols.</span>
                </div>

                <button type="submit" disabled={authLoading} className="btn-premium gradient-bg btn-submit">
                  {authLoading ? 'Creating...' : 'Register'}
                </button>
              </form>
            )}

            {/* TAB 3: VERIFY EMAIL */}
            {authTab === 'verify' && (
              <form onSubmit={handleVerify} className="auth-form">
                <div className="verify-icon-wrapper pulse-glow">
                  <MailCheck size={32} style={{ color: 'var(--accent-color)' }} />
                </div>
                <div className="form-title Outfit">Verify Email Address</div>
                <p className="form-subtitle">We have sent a verification code to <strong>{emailField}</strong>. Enter it below to activate your account in AWS Cognito.</p>

                <div className="form-group">
                  <label htmlFor="verification-code">Verification Code</label>
                  <input 
                    type="text" 
                    id="verification-code" 
                    placeholder="123456" 
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                    maxLength="6"
                    className="glass font-bold text-center"
                    style={{ letterSpacing: '8px', fontSize: '1.25rem' }}
                  />
                </div>

                <button type="submit" disabled={authLoading} className="btn-premium gradient-bg btn-submit">
                  {authLoading ? 'Verifying...' : 'Verify & Activate'}
                </button>

                <button 
                  type="button" 
                  className="btn-text" 
                  onClick={() => { setAuthTab('signup'); clearAuthForm(); }}
                  style={{ marginTop: '12px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Back to Sign Up
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer glass">
        <p className="copyright">© Sahan</p>
      </footer>
    </div>
  );
}

export default App;
