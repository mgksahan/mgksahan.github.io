import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import sahanPhoto from '../../assets/sahan.webp';
import { apiService } from '../../apiService';
import { certifications, type Cert } from '../data/certifications';

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

const MINI = 30;
const GAP = 6;

function statusOf(c: Cert) {
  return c.progress !== undefined ? `In progress, ${c.progress}%` : c.expired ? `Expired ${c.expired}` : c.issued ? `Issued ${c.issued}` : 'Completed';
}

function Medal({ c }: { c: Cert }) {
  const pending = c.progress !== undefined;
  return (
    <span className={`medal${pending ? ' locked' : ''}${c.expired ? ' expired' : ''}`} aria-hidden="true">
      {pending && (
        <svg viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" className="ring-bg" />
          <circle cx="18" cy="18" r="16" className="ring" strokeDasharray={`${(c.progress! / 100) * 100.5} 100.5`} />
        </svg>
      )}
      {c.logo ? (
        <img className={`logo${c.logo.endsWith('.png') ? ' tile' : /ielts|belden/.test(c.logo) ? ' plate' : ''}`} src={`${import.meta.env.BASE_URL}certs/${c.logo}`} alt="" />
      ) : (
        <span className="glyph">{c.icon}</span>
      )}
      {pending && <b className="pct">{c.progress}%</b>}
    </span>
  );
}

function Achievements() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState(6);
  const stripRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const total = certifications.length;
  const earned = certifications.filter((c) => c.progress === undefined).length;
  const sorted = [...certifications].sort((a, b) => Number(b.progress !== undefined) - Number(a.progress !== undefined));

  // How many mini badges fit in the pill (one slot is kept for the "+N" chip when some are hidden)
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => setSlots(Math.max(1, Math.floor((el.clientWidth + GAP) / (MINI + GAP))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const pill = pillRef.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      pill?.focus();
    };
  }, [open]);

  const shown = slots >= total ? total : Math.max(0, slots - 1);
  const hidden = total - shown;

  return (
    <>
      <button
        type="button"
        ref={pillRef}
        className="ach-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Achievements, ${earned} of ${total} unlocked. Open`}
        onClick={() => setOpen(true)}
      >
        <svg className="trophy" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v3a5 5 0 0 1-10 0V4Zm-3 1h3v2a3 3 0 0 1-3-2Zm16 0h-3v2a3 3 0 0 0 3-2ZM11 13h2v3h3v2H8v-2h3v-3Z" /></svg>
        <span className="ach-count">{earned}/{total}</span>
        <span className="ach-strip" ref={stripRef}>
          {sorted.slice(0, shown).map((c) => <Medal key={c.name} c={c} />)}
          {hidden > 0 && <span className="ach-more">+{hidden}</span>}
        </span>
      </button>

      {open && (
        <div className="ach-overlay" onClick={() => setOpen(false)}>
          <div className="ach-panel" role="dialog" aria-modal="true" aria-labelledby="ach-title" onClick={(e) => e.stopPropagation()}>
            <div className="ach-head">
              <h3 id="ach-title">Achievements <span>{earned}/{total} unlocked</span></h3>
              <button type="button" ref={closeRef} className="ach-close" aria-label="Close achievements" onClick={() => setOpen(false)}>&times;</button>
            </div>
            <ul className="ach-grid">
              {sorted.map((c) => (
                <li key={c.name} className={`ach-card${c.progress !== undefined ? ' locked' : ''}${c.expired ? ' expired' : ''}`}>
                  <Medal c={c} />
                  <div>
                    <strong>{c.name}</strong>
                    <span>{c.issuer}</span>
                    <em>{statusOf(c)}</em>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
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
      <Achievements />
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
