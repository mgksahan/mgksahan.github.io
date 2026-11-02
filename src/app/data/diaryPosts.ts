export type DiaryPost = {
  id: number;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
};

export const diaryPosts: DiaryPost[] = [
  {
    id: 1,
    title: 'Getting Started with React and TypeScript',
    excerpt:
      'Learn the fundamentals of building modern web applications with React and TypeScript. This guide covers setup, best practices, and common patterns.',
    date: '2026-05-15',
    tags: ['React', 'TypeScript', 'Frontend', 'Learning'],
  },
  {
    id: 2,
    title: 'The Future of Web Development',
    excerpt:
      'Exploring emerging trends in web development, from AI-powered tools to the latest framework innovations that are shaping how we build for the web.',
    date: '2026-05-10',
    tags: ['Web Dev', 'AI', 'Trends', 'Frontend'],
  },
  {
    id: 3,
    title: 'Mastering CSS Grid and Flexbox',
    excerpt:
      'A comprehensive guide to modern CSS layout techniques. Learn when to use Grid vs Flexbox and how to combine them for powerful, responsive designs.',
    date: '2026-05-05',
    tags: ['CSS', 'Frontend', 'Design', 'Learning'],
  },
  {
    id: 4,
    title: 'Building Accessible Web Applications',
    excerpt:
      'Accessibility is crucial for inclusive web experiences. Discover practical techniques for making your applications usable by everyone.',
    date: '2026-04-28',
    tags: ['Accessibility', 'Web Dev', 'Design', 'UX'],
  },
  {
    id: 5,
    title: 'Rust for TypeScript Developers',
    excerpt:
      'My experience learning Rust after years of TypeScript. The ownership model is challenging but rewarding, and the mental model transfers surprisingly well.',
    date: '2026-04-18',
    tags: ['Rust', 'TypeScript', 'Learning', 'Systems'],
  },
  {
    id: 6,
    title: 'Thoughts on Engineering Culture',
    excerpt:
      'What separates good engineering teams from great ones? Reflections on communication, documentation, and the underrated value of boring infrastructure.',
    date: '2026-04-05',
    tags: ['Culture', 'Teams', 'Career'],
  },
];

export function getAllTags(): string[] {
  const tagCounts = new Map<string, number>();
  diaryPosts.forEach((post) => {
    post.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });
  return Array.from(tagCounts.keys());
}
