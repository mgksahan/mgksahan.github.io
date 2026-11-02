import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Calendar, X } from 'lucide-react';
import { apiService } from '../../apiService';
import { getPosts } from '../../postsLoader';

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

interface Tag3D {
  text: string;
  cx: number;
  cy: number;
  cz: number;
}

export function InterestsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagParam = searchParams.get('tag');

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(tagParam);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // 3D Sphere State Refs (to avoid triggering React render cycles on every frame)
  const tagElementsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const isMouseOver = useRef(false);
  const isTagHovered = useRef(false);
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  
  // Current speeds
  const curSpeedX = useRef(0.2); // default slow rotation speed
  const curSpeedY = useRef(0.2);

  // Load hybrid posts on mount
  useEffect(() => {
    const loadPostsData = async () => {
      setPostsLoading(true);
      try {
        const staticPosts = getPosts() as Post[];
        const dbPosts = await apiService.fetchPosts() as Post[];
        setPosts([...dbPosts, ...staticPosts]);
      } catch (err) {
        console.error('Failed to load posts for Interests:', err);
      } finally {
        setPostsLoading(false);
      }
    };
    loadPostsData();
  }, []);

  // Sync selected state with query parameter
  useEffect(() => {
    setSelected(tagParam);
    if (tagParam && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [tagParam]);

  // Extract unique tags and calculate frequencies
  const tagData = useMemo(() => {
    const frequencies: Record<string, number> = {};
    posts.forEach((post) => {
      post.tags.forEach((tag) => {
        frequencies[tag] = (frequencies[tag] || 0) + 1;
      });
    });
    const uniqueTags = Object.keys(frequencies);
    return { uniqueTags, frequencies };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!selected) return [];
    return posts.filter((p) => p.tags.includes(selected));
  }, [selected, posts]);

  // Main 3D tag calculation loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container || tagData.uniqueTags.length === 0) return;

    const max = tagData.uniqueTags.length;
    const radius = 135; // Sphere radius
    const diameter = radius * 2;
    const dtr = Math.PI / 180;

    // Distribute tags uniformly over the sphere on mount
    const tags3d: Tag3D[] = tagData.uniqueTags.map((tag, i) => {
      const phi = Math.acos(-1 + (2 * (i + 1) - 1) / max);
      const theta = Math.sqrt(max * Math.PI) * phi;
      return {
        text: tag,
        cx: radius * Math.cos(theta) * Math.sin(phi),
        cy: radius * Math.sin(theta) * Math.sin(phi),
        cz: radius * Math.cos(phi),
      };
    });

    let animationFrameId: number;

    const updateSphere = () => {
      const rect = container.getBoundingClientRect();
      const halfWidth = rect.width / 2;
      const halfHeight = rect.height / 2;

      let targetSpeedX = 0.2;
      let targetSpeedY = 0.2;

      if (isTagHovered.current) {
        // Stop rotation completely when hovering over a tag to allow easy clicking
        targetSpeedX = 0;
        targetSpeedY = 0;
      } else if (isMouseOver.current) {
        // Map mouse position relative to center to speeds (-0.8 to 0.8 px per frame)
        // Ergonomically friendly rotation cap prevents tags from flying away.
        targetSpeedX = ((mouseX.current - halfWidth) / halfWidth) * 0.8;
        targetSpeedY = -((mouseY.current - halfHeight) / halfHeight) * 0.8;
      }

      // Smoothly interpolate speeds for fluid rotation inertia (faster deceleration on hover)
      const interpolationFactor = isTagHovered.current ? 0.15 : 0.08;
      curSpeedX.current += (targetSpeedX - curSpeedX.current) * interpolationFactor;
      curSpeedY.current += (targetSpeedY - curSpeedY.current) * interpolationFactor;

      const fy = curSpeedY.current;
      const fx = curSpeedX.current;

      if (Math.abs(fy) > 0.01 || Math.abs(fx) > 0.01) {
        const cosY = Math.cos(fy * dtr);
        const sinY = Math.sin(fy * dtr);
        const cosX = Math.cos(fx * dtr);
        const sinX = Math.sin(fx * dtr);

        tags3d.forEach((tagItem) => {
          // 3D rotation transform matrices
          const rx1 = tagItem.cx;
          const ry1 = tagItem.cy * cosY + tagItem.cz * -sinY;
          const rz1 = tagItem.cy * sinY + tagItem.cz * cosY;

          tagItem.cx = rx1 * cosX + rz1 * sinX;
          tagItem.cy = ry1;
          tagItem.cz = rx1 * -sinX + rz1 * cosX;

          // 3D perspective projection formula
          const per = diameter / (diameter + tagItem.cz);
          const x = tagItem.cx * per;
          const y = tagItem.cy * per;

          const button = tagElementsRef.current[tagItem.text];
          if (button) {
            // Offset coordinates to align button centers
            const left = x + halfWidth - button.offsetWidth / 2;
            const top = y + halfHeight - button.offsetHeight / 2;
            button.style.left = `${left}px`;
            button.style.top = `${top}px`;

            // Adjust scale, depth styling, and opacity based on Z axis position
            const scale = per * 0.95; // scaling
            const opacity = 0.25 + (per - 0.5) * 0.8; // opacity fade
            
            button.style.transform = `scale(${scale})`;
            button.style.opacity = `${Math.min(Math.max(opacity, 0.15), 1.0)}`;
            button.style.zIndex = `${Math.round(200 - tagItem.cz)}`;
          }
        });
      }

      animationFrameId = requestAnimationFrame(updateSphere);
    };

    animationFrameId = requestAnimationFrame(updateSphere);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [tagData]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    mouseX.current = e.clientX - rect.left;
    mouseY.current = e.clientY - rect.top;
  };

  const handleTagClick = (tag: string) => {
    if (selected === tag) {
      setSearchParams({});
      setSelected(null);
    } else {
      setSearchParams({ tag });
      setSelected(tag);
    }
  };

  const handlePostClick = (post: Post) => {
    navigate(`/diary`, { state: { openPostSlug: post.slug || post.id } });
  };

  // Tag font size variations based on frequency
  const getTagSizeClass = (tag: string) => {
    const frequencies = tagData.frequencies;
    const maxFreq = Math.max(...Object.values(frequencies), 1);
    const freq = frequencies[tag] || 1;
    const ratio = freq / maxFreq;
    
    if (ratio > 0.75) return 'text-xl font-bold tracking-tight';
    if (ratio > 0.45) return 'text-base font-semibold';
    return 'text-xs font-medium opacity-70';
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl space-y-10 animate-fade-in">
      
      {/* 3D Sphere Tag Cloud container (clean borderless transparent layout) */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden flex items-center justify-center cursor-default select-none bg-transparent"
        style={{ height: '380px' }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => { isMouseOver.current = true; }}
        onMouseLeave={() => { 
          isMouseOver.current = false; 
          isTagHovered.current = false;
          mouseX.current = 0; 
          mouseY.current = 0;
        }}
      >
        {tagData.uniqueTags.map((tag) => {
          const isSelected = selected === tag;
          const isDeselected = selected !== null && !isSelected;
          
          return (
            <button
              key={tag}
              ref={(el) => { tagElementsRef.current[tag] = el; }}
              onClick={() => handleTagClick(tag)}
              onMouseEnter={() => { isTagHovered.current = true; }}
              onMouseLeave={() => { isTagHovered.current = false; }}
              className={[
                'absolute cursor-pointer border-none bg-transparent outline-none transition-all duration-300 font-medium float-tag-item p-4',
                getTagSizeClass(tag),
                isSelected
                  ? 'text-primary scale-125 z-50 underline underline-offset-4 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] font-bold'
                  : isDeselected
                  ? 'opacity-20 hover:opacity-50 text-muted-foreground'
                  : 'text-foreground hover:text-primary hover:scale-110 drop-shadow-sm',
              ].join(' ')}
              style={{
                // Styles will be updated dynamically via DOM reference in the rAF loop
                left: '50%',
                top: '50%',
              }}
            >
              {tag}
            </button>
          );
        })}
        <style>{`
          .float-tag-item {
            will-change: left, top, transform, opacity;
            transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), text-shadow 0.3s ease;
          }
          .float-tag-item:hover {
            z-index: 999 !important;
            color: var(--primary) !important;
            text-shadow: 0 0 10px var(--primary);
            opacity: 1 !important;
          }
        `}</style>
      </div>

      {/* Results */}
      {selected && (
        <div ref={resultsRef} className="space-y-4 pt-4 glow-line-t animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              Entries Tagged:
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs px-3 py-1 font-semibold">
                #{selected}
                <button
                  onClick={() => handleTagClick(selected)}
                  className="hover:opacity-75 transition-opacity ml-1 cursor-pointer"
                  aria-label="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </h2>
            <span className="text-sm opacity-55 font-semibold">
              {filteredPosts.length} {filteredPosts.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredPosts.map((post) => (
              <Card 
                key={post.slug || post.id} 
                className="hover:shadow-md transition-all cursor-pointer bg-card border-muted hover:bg-muted/5 flex flex-col justify-between"
                onClick={() => handlePostClick(post)}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base font-bold text-left line-clamp-1">{post.title}</CardTitle>
                    <span className="flex items-center gap-1 text-[11px] opacity-50 font-mono">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
                  <p className="text-xs opacity-70 leading-relaxed text-left line-clamp-3">
                    {post.excerpt || post.content.replace(/[#*`_-]/g, '').slice(0, 120) + '...'}
                  </p>
                  <div className="flex flex-wrap gap-1 border-t border-border/10 pt-2">
                    {post.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={tag === selected ? 'default' : 'secondary'}
                        className="text-[9px] px-1.5 py-0.5 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagClick(tag);
                        }}
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
