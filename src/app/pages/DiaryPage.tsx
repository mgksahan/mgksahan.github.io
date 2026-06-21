import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../../apiService';
import { getPosts } from '../../postsLoader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { 
  Calendar, 
  MessageSquare, 
  ArrowLeft, 
  Clock, 
  User as UserIcon, 
  Send, 
  Lock, 
  Search,
  PenTool,
  BookOpen,
  LogOut
} from 'lucide-react';
import { marked } from 'marked';
import { toast } from 'sonner';

type Post = {
  slug?: string;
  id?: string;
  title: string;
  date: string;
  excerpt?: string;
  categories: string[];
  tags: string[];
  content: string;
  authorName?: string;
};

type Comment = {
  id: string;
  name: string;
  date: string;
  text: string;
};

export function DiaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
  };

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch posts on mount
  useEffect(() => {
    loadHybridPosts();
  }, []);

  // Open specific post if passed in navigation state (e.g. from Interests page)
  useEffect(() => {
    if (location.state && location.state.openPostSlug && posts.length > 0) {
      const targetPost = posts.find(p => (p.slug || p.id) === location.state.openPostSlug);
      if (targetPost) {
        setActivePost(targetPost);
        // Clear navigation state to prevent re-opening on manual refresh/back navs
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, posts]);

  // Fetch comments when activePost changes
  useEffect(() => {
    if (activePost) {
      loadPostComments(activePost.slug || activePost.id || '');
    }
  }, [activePost]);

  const loadHybridPosts = async () => {
    setPostsLoading(true);
    try {
      const staticPosts = getPosts() as Post[];
      const dbPosts = await apiService.fetchPosts() as Post[];
      const merged = [...dbPosts, ...staticPosts];
      const sorted = merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPosts(sorted);
    } catch (e) {
      console.error('Error loading hybrid posts:', e);
      toast.error('Failed to load diary entries.');
    } finally {
      setPostsLoading(false);
    }
  };

  const loadPostComments = async (postSlug: string) => {
    setCommentsLoading(true);
    try {
      const liveComments = await apiService.fetchComments(postSlug);
      setComments(liveComments);
    } catch (e) {
      console.error('Error loading comments:', e);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activePost) return;

    try {
      const commentData = {
        postSlug: activePost.slug || activePost.id || '',
        name: user?.name || 'Anonymous',
        text: newCommentText.trim()
      };
      
      const publishedComment = await apiService.createComment(commentData, user?.token);
      setComments((prev) => [publishedComment, ...prev]);
      setNewCommentText('');
      toast.success('Comment published!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit comment.');
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    // Navigate to Interests tag cloud page with this tag selected
    navigate(`/interests?tag=${encodeURIComponent(tag)}`);
  };

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Single post reader view
  if (activePost) {
    const readingTime = Math.ceil(activePost.content.split(' ').length / 200);

    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8 animate-fade-in">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setActivePost(null)}
          className="cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Diary
        </Button>

        <article className="border rounded-2xl bg-card text-card-foreground shadow-sm p-8 space-y-6">
          <header className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {activePost.categories.map((cat) => (
                <Badge key={cat} variant="secondary">{cat}</Badge>
              ))}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{activePost.title}</h1>
            
            <div className="flex flex-wrap gap-4 text-sm opacity-60">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(activePost.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {readingTime} min read
              </span>
              {activePost.authorName && (
                <span className="flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4" />
                  By {activePost.authorName}
                </span>
              )}
            </div>
          </header>

          <Separator />

          <div 
            className="prose dark:prose-invert max-w-none text-base leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ __html: marked.parse(activePost.content) }}
          />

          <Separator />

          <footer className="space-y-2">
            <p className="text-xs font-bold opacity-50 uppercase tracking-wider">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {activePost.tags.map((tag) => (
                <span 
                  key={tag} 
                  className="text-xs font-medium text-primary hover:underline cursor-pointer"
                  onClick={(e) => handleTagClick(e, tag)}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </footer>
        </article>

        {/* Live comments */}
        <section className="border rounded-2xl bg-card text-card-foreground shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between glow-line-b pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 opacity-80" />
              <h2 className="text-lg font-bold">Community Conversations</h2>
            </div>
            <Badge variant="outline">{comments.length} Comments</Badge>
          </div>

          {/* List of Comments */}
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2 divide-y divide-border/50">
            {commentsLoading ? (
              <div className="text-center py-6">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs opacity-60">Loading conversation...</p>
              </div>
            ) : comments.length > 0 ? (
              comments.map((comment, index) => (
                <div key={comment.id || index} className={`pt-4 ${index === 0 ? 'pt-0' : ''} space-y-1.5`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-primary">{comment.name}</span>
                    <span className="opacity-40">•</span>
                    <span className="opacity-50">{comment.date}</span>
                  </div>
                  <p className="text-sm opacity-80 leading-relaxed text-left">{comment.text}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 opacity-50 text-sm">
                No comments yet. Be the first to start the discussion!
              </div>
            )}
          </div>

          {/* Post a Comment Block */}
          <div className="glow-line-t pt-4">
            {user ? (
              <form onSubmit={handleAddComment} className="space-y-3">
                <div className="flex items-center gap-2 text-xs opacity-75">
                  <span className="font-semibold">Posting as {user.name}</span>
                </div>
                <Textarea 
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Join the discussion, share your thoughts..."
                  rows={3}
                  required
                />
                <Button type="submit" size="sm" className="cursor-pointer">
                  <Send className="w-3.5 h-3.5 mr-2" /> Send Comment
                </Button>
              </form>
            ) : (
              <div className="p-4 rounded-xl border bg-muted/20 text-center space-y-3">
                <Lock className="w-6 h-6 mx-auto opacity-40" />
                <div>
                  <h4 className="font-semibold text-sm">Join the conversation</h4>
                  <p className="text-xs opacity-65">Log in via AWS Cognito to ask questions and participate in comments.</p>
                </div>
                <Button size="sm" onClick={() => navigate('/login')} className="cursor-pointer">
                  Log In / Sign Up
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glow-line-b pb-6">
        <div>
          <h1 className="text-4xl mb-2 font-bold tracking-tight">Diary</h1>
          <p className="opacity-60 text-sm">Thoughts on engineering, design, and things I'm learning.</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {user ? (
            <>
              <Button onClick={() => navigate('/diary/write')} size="sm" className="cursor-pointer">
                <PenTool className="w-4.5 h-4.5 mr-1.5" />
                Write Entry
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm" className="cursor-pointer">
                <LogOut className="w-4 h-4 mr-1.5" />
                Logout
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate('/login')} variant="outline" size="sm" className="cursor-pointer">
              Login to Write
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 opacity-40" />
        <Input 
          type="text" 
          placeholder="Search diary entries by title, content, or tags..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {postsLoading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm opacity-60">Loading writings feed...</p>
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <Card 
              key={post.slug || post.id} 
              className="hover:shadow-md transition-all cursor-pointer border-muted bg-card hover:bg-muted/10"
              onClick={() => setActivePost(post)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg font-bold tracking-tight">{post.title}</CardTitle>
                  <span className="flex items-center gap-1 text-xs opacity-50 shrink-0 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(post.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm opacity-70 leading-relaxed text-left">
                  {post.excerpt || post.content.replace(/[#*`_-]/g, '').slice(0, 180) + '...'}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/20">
                  <div className="flex flex-wrap gap-1">
                    {post.tags.map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="text-[10px] px-1.5 py-0.5 cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={(e) => handleTagClick(e, tag)}
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  {post.authorName && (
                    <span className="text-[10px] opacity-50 italic">By {post.authorName}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-xl p-6 bg-muted/5">
          <BookOpen className="w-10 h-10 opacity-30 mx-auto mb-2" />
          <h3 className="font-semibold text-lg">No entries found</h3>
          <p className="text-sm opacity-60 max-w-sm mx-auto">Try refining your search terms or view existing tags in Interests.</p>
        </div>
      )}
    </div>
  );
}
