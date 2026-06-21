import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../../apiService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { PenTool, Eye, Calendar, Clock, User, ArrowLeft } from 'lucide-react';
import { marked } from 'marked';
import { toast } from 'sonner';

export function WritePage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  
  const [writeLoading, setWriteLoading] = useState(false);

  // Check auth
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error('You must be logged in to access this page.');
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] space-y-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm opacity-60">Checking credentials...</p>
      </div>
    );
  }

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category.trim() || !content.trim()) {
      toast.error('Title, Category and Content are required.');
      return;
    }

    setWriteLoading(true);
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const postData = {
        title: title.trim(),
        content: content.trim(),
        categories: [category.trim()],
        tags: parsedTags,
        date: new Date().toISOString().split('T')[0],
        authorName: user.name
      };

      await apiService.createPost(postData, user.token);
      toast.success('Article published to DynamoDB successfully!');
      
      // Navigate to diary page
      navigate('/diary');
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish post.');
    } finally {
      setWriteLoading(false);
    }
  };

  const readingTime = Math.ceil(content.split(' ').length / 200) || 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/diary')}
          className="cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PenTool className="w-5 h-5 text-primary" />
          Write Post
        </h1>
        <div className="w-16"></div> {/* spacer */}
      </div>

      <form onSubmit={handlePublishPost} className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Editor workspace */}
        <div className="border rounded-2xl bg-card text-card-foreground shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold">Workspace Editor</h2>
          <Separator />
          
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-title">Article Title</Label>
              <Input
                id="post-title"
                placeholder="The Future of Serverless Architectures"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="post-category">Category</Label>
                <Input
                  id="post-category"
                  placeholder="Embedded Systems"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-tags">Tags (comma-separated)</Label>
                <Input
                  id="post-tags"
                  placeholder="verilog, fpga, altium"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="post-content">Body Content (Markdown Supported)</Label>
              <Textarea
                id="post-content"
                placeholder="# Hello World!&#10;&#10;Write your post body content here using markdown rules..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={12}
                className="font-mono text-sm leading-relaxed"
              />
            </div>
          </div>

          <Button type="submit" disabled={writeLoading} className="w-full cursor-pointer mt-4">
            {writeLoading ? 'Publishing to DynamoDB...' : 'Publish Article'}
          </Button>
        </div>

        {/* Live Preview */}
        <div className="hidden lg:flex border rounded-2xl bg-card text-card-foreground shadow-sm p-6 space-y-4 h-[630px] flex flex-col">
          <div className="flex items-center gap-2 text-sm font-semibold opacity-85 border-b pb-2">
            <Eye className="w-4 h-4" />
            <span>LIVE RENDER PREVIEW</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <header className="space-y-2">
              <div className="flex">
                <Badge variant="secondary">{category || 'Category'}</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{title || 'Title Placeholder'}</h1>
              
              <div className="flex flex-wrap gap-3 text-xs opacity-50">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Today
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {readingTime} min read
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  By {user.name}
                </span>
              </div>
            </header>

            <Separator />

            <div 
              className="prose dark:prose-invert max-w-none text-sm leading-relaxed space-y-3"
              dangerouslySetInnerHTML={{ 
                __html: content.trim() 
                  ? marked.parse(content) 
                  : '<p class="opacity-40 italic">Begin typing in the editor to see your formatted post render live here...</p>'
              }}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
