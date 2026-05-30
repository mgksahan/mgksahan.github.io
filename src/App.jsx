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
  X
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
  const [theme, setTheme] = useState('dark');
  const [activeTab, setActiveTab] = useState('blog'); // 'blog' or 'write'
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

  useEffect(() => {
    // Initial load
    loadHybridPosts();

    // Check current Cognito user
    setCurrentUser(cognitoService.getCurrentUser());

    // Set theme
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const savedTheme = localStorage.getItem('sahan-theme') || systemTheme;
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
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
      {/* Dynamic Navigation */}
      <nav className="navbar">
        <div className="nav-logo gradient-text" onClick={() => { setActivePost(null); setActiveTab('blog'); }}>
          <Sparkles className="pulse-glow" style={{ color: 'var(--accent-color)' }} />
          Sahan Gamage
        </div>
        
        <div className="nav-actions">
          <button 
            className={`nav-tab-btn ${activeTab === 'blog' && !activePost ? 'active' : ''}`}
            onClick={() => { setActiveTab('blog'); setActivePost(null); }}
          >
            Blog
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
      ) : (
        // CLEAN MINIMALIST BLOG WRITINGS VIEW
        <div className="blog-wrapper animate-slide-up">
          {/* Sahan's Personal Profile Info Header */}
          <header className="blog-profile-header glass pulse-glow">
            <div className="profile-grid">
              <img 
                src="https://avatars.githubusercontent.com/u/50710155?v=4" 
                alt="Sahan Gamage Profile" 
                className="profile-avatar"
              />
              <div className="profile-details text-left">
                <h1 className="Outfit">Sahan Gamage</h1>
                <p className="role-title">IoT Architect & Software Engineer</p>
                <p className="bio-summary">
                  I write about designing hardware systems, firmware hacking, serverless AWS infrastructures, and my signature accelerometer barbell speed tracker. Join the community to publish posts!
                </p>
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
              </div>
            </div>
          </header>

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
        <p className="copyright">&copy; {new Date().getFullYear()} Sahan Gamage. Powered by Vite, React, and AWS Cognito.</p>
        <p className="disclaimer">Serverless Comments connected to AWS API Gateway & DynamoDB.</p>
      </footer>
    </div>
  );
}

export default App;
