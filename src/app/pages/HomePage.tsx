import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import sahanPhoto from '../../assets/sahan.webp';
import { apiService } from '../../apiService';

type RailPost = {
  slug?: string;
  id?: string;
  title: string;
  date: string;
  categories: string[];
  content: string;
};

// First markdown image in the post body, used as the card cover
function coverImage(content: string) {
  const m = content.match(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/);
  return m ? m[1] : null;
}

// Plain-text preview: drop images, code, markdown syntax
function excerpt(content: string, max = 140) {
  const text = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return isNaN(d.getTime()) ? date : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function PostsRail() {
  const [posts, setPosts] = useState<RailPost[] | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const dbPosts = (await apiService.fetchPosts()) as RailPost[];
      const merged = [...dbPosts]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 12);
      if (!cancelled) setPosts(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollByCard = (dir: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>('.post-card');
    rail.scrollBy({ left: dir * ((card?.offsetWidth || 300) + 16), behavior: 'smooth' });
  };

  return (
    <section id="posts">
      <div className="posts-head">
        <h2>Posts</h2>
        <div className="posts-nav">
          <button type="button" aria-label="Previous posts" onClick={() => scrollByCard(-1)}>&larr;</button>
          <button type="button" aria-label="Next posts" onClick={() => scrollByCard(1)}>&rarr;</button>
          <Link to="/diary">All posts</Link>
        </div>
      </div>
      <div className="posts-rail" ref={railRef} tabIndex={0} aria-label="Recent posts">
        {posts === null &&
          [0, 1, 2].map((i) => <div key={i} className="post-card skeleton" aria-hidden="true" />)}
        {posts?.length === 0 && <p className="posts-empty">No posts yet.</p>}
        {posts?.map((post) => {
          const slug = post.slug || post.id || '';
          const cover = coverImage(post.content);
          return (
            <Link key={slug} to="/diary" state={{ openPostSlug: slug }} className="post-card">
              {cover && <img src={cover} alt="" loading="lazy" />}
              <div className="post-body">
                <div className="post-meta">
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  {post.categories?.[0] && <span>{post.categories[0]}</span>}
                </div>
                <h3>{post.title}</h3>
                <p>{excerpt(post.content)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function HomePage() {
  useEffect(() => {
    document.documentElement.classList.add('js');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function wrap(n: Node) {
      Array.prototype.slice.call(n.childNodes).forEach((c: Node) => {
        if (c.nodeType === 3) {
          const f = document.createDocumentFragment();
          (c.textContent || '').split('').forEach((ch: string) => {
            const x = document.createElement('span');
            x.className = 'ch';
            x.textContent = ch;
            f.appendChild(x);
          });
          c.parentNode?.replaceChild(f, c);
        } else if (c.nodeType === 1) {
          wrap(c);
        }
      });
    }

    const cur = document.createElement('span');
    cur.className = 'cur';
    cur.setAttribute('aria-hidden', 'true');

    const seq = document.querySelectorAll('.seq');
    function revealSeq() {
      seq.forEach((e: Element, k: number) => {
        (e as HTMLElement).style.setProperty('--sd', `${k * 0.12}s`);
        e.classList.add('in');
      });
    }

    const greetElem = document.querySelector('.greet .t');
    const groups = [greetElem].filter(Boolean).map((t) => {
      wrap(t!);
      return Array.prototype.slice.call(t!.querySelectorAll('.ch'));
    });

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (groups.length && groups[0].length > 0) {
      if (reduce) {
        groups.forEach((g) => {
          g.forEach((c: HTMLElement) => c.classList.add('on'));
        });
        const l = groups[groups.length - 1];
        if (l.length > 0) {
          l[l.length - 1].after(cur);
        }
        revealSeq();
      } else {
        let g = 0, i = 0;
        groups[0][0].before(cur);

        const step = () => {
          const ch = groups[g];
          if (i < ch.length) {
            ch[i].classList.add('on');
            ch[i].after(cur);
            i++;
            timer = setTimeout(step, 22 + Math.random() * 22);
          } else if (g < groups.length - 1) {
            g++;
            i = 0;
            groups[g][0].before(cur);
            timer = setTimeout(step, 420);
          } else {
            timer = setTimeout(revealSeq, 60);
          }
        };
        step();
      }
    } else {
      revealSeq();
    }

    const els = document.querySelectorAll('section h2, .proj, .about p, .timeline li, .contact a, .contact p');
    els.forEach((e: Element) => {
      e.classList.add('reveal');
      if (e.parentNode) {
        const sib = Array.prototype.indexOf.call(e.parentNode.children, e);
        (e as HTMLElement).style.setProperty('--d', `${Math.min(sib, 5) * 0.1}s`);
      }
    });

    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window && !reduce) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((x) => {
            if (x.isIntersecting) {
              x.target.classList.add('in');
              io?.unobserve(x.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
      );
      els.forEach((e) => io?.observe(e));
    } else {
      els.forEach((e) => e.classList.add('in'));
    }

    return () => {
      if (timer) clearTimeout(timer);
      io?.disconnect();
    };
  }, []);

  return (
    <div className="wrap">
      <nav>
        <Link to="/" className="name">sahan.gamage</Link>
        <div>
          <Link to="/diary">Diary</Link>
          <Link to="/interests">Interests</Link>
          <Link to="/fitness">Fitness</Link>
        </div>
      </nav>

      <header className="hero">
        <div className="left">
          <h1 className="greet" aria-label="Hi, I'm Sahan">
            <span className="t" aria-hidden="true">Hi, I'm <span className="hl">Sahan</span></span>
          </h1>
          <p className="tag seq"><span className="t">I make systems talk to each other.</span></p>
          <p className="lede seq">I build the pipelines that carry data from where it's born to where it's useful. <b>Quick to ship, light to run, ready to scale.</b></p>
          <p className="cta seq">
            <a className="btn" href="#work">See my work</a>
            <a href="#contact">Get in touch</a>
          </p>
        </div>
        <div className="photo">
          <img src={sahanPhoto} alt="Sahan Gamage smiling with arms crossed" width="698" height="1000" />
        </div>
      </header>

      <PostsRail />

      <section id="work">
        <h2>Selected work</h2>
        <article className="proj">
          <div className="meta">
            <h3>Project name</h3>
            <div className="stack">Python, REST, MQTT</div>
          </div>
          <div className="body">
            <p>One sentence on the problem you solved and who it was for.</p>
            <p className="res">Result: replace with a real outcome, such as latency cut, hours saved or devices supported.</p>
          </div>
        </article>
        <article className="proj">
          <div className="meta">
            <h3>Project name</h3>
            <div className="stack">C#, Azure, SQL</div>
          </div>
          <div className="body">
            <p>One sentence on the problem you solved and who it was for.</p>
            <p className="res">Result: replace with a real outcome.</p>
          </div>
        </article>
        <article className="proj">
          <div className="meta">
            <h3>Project name</h3>
            <div className="stack">Docker, CI/CD, Grafana</div>
          </div>
          <div className="body">
            <p>One sentence on the problem you solved and who it was for.</p>
            <p className="res">Result: replace with a real outcome.</p>
          </div>
        </article>
      </section>

      <section id="about" className="about">
        <h2>About</h2>
        <p>Write two or three plain sentences here: what you work on, what you care about in how systems are built, and what you want to work on next.</p>
        <ul className="timeline">
          <li><span>2023-2024</span>Graduate Certificate, Embedded Systems Development, Conestoga College</li>
          <li><span>2017-2021</span>B.Eng (Hons.), Electrical &amp; Computer Systems Engineering, Monash University</li>
        </ul>
      </section>

      <section id="contact" className="contact">
        <h2>Contact</h2>
        <a href="mailto:mgk.sahan@gmail.com">mgk.sahan@gmail.com</a>
        <p>
          <a href="https://github.com/mgksahan" target="_blank" rel="noopener noreferrer">GitHub</a>
          {" \u00A0 "}
          <a href="https://linkedin.com/in/mgksahan" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </p>
      </section>

      <footer>sahangamage.click</footer>
    </div>
  );
}
