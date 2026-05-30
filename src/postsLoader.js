// Simple loader to parse Jekyll-style Markdown posts in Vite
const rawPosts = import.meta.glob('/_posts/*.md', { query: '?raw', eager: true });

function parseMarkdown(filename, rawContent) {
  // Regex to split front matter (between ---) and body content
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  
  if (!match) {
    return {
      slug: filename.replace(/^\/_posts\//, '').replace(/\.md$/, ''),
      title: filename.replace(/^\/_posts\//, '').replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' '),
      date: '',
      categories: [],
      tags: [],
      content: rawContent
    };
  }

  const frontMatterBlock = match[1];
  const content = match[2];
  
  const metadata = {};
  frontMatterBlock.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();
      
      // Parse array like [Hello World] or ["Hello World"]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
      } else {
        value = value.replace(/^['"]|['"]$/g, '');
      }
      metadata[key] = value;
    }
  });

  const slug = filename.replace(/^\/_posts\//, '').replace(/\.md$/, '');
  
  // Extract date from filename if not present or malformed in front matter
  const filenameDateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  const dateVal = metadata.date || (filenameDateMatch ? filenameDateMatch[1] : '');
  // Clean date string (in case of time parts)
  const cleanDate = typeof dateVal === 'string' ? dateVal.split(' ')[0] : dateVal;

  return {
    slug,
    title: metadata.title || slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' '),
    date: cleanDate,
    categories: metadata.categories || [],
    tags: metadata.tags || [],
    content: content.trim()
  };
}

export const getPosts = () => {
  const posts = Object.entries(rawPosts).map(([path, module]) => {
    const rawContent = typeof module === 'string' ? module : (module.default || '');
    return parseMarkdown(path, rawContent);
  });
  
  // Sort posts by date descending
  return posts.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
};
