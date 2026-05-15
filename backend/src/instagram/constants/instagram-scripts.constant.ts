export const EXTRACT_POST_SCRIPT = () => {
  const doc = (globalThis as any).document;

  // Primary: og:description (server-rendered by Instagram)
  let caption = doc.querySelector('meta[property="og:description"]')?.content || '';

  // Fallback 1: name="description" meta
  if (!caption) {
    caption = doc.querySelector('meta[name="description"]')?.content || '';
  }

  // Fallback 2: first article span with meaningful text (JS-rendered)
  if (!caption) {
    const spans = Array.from(doc.querySelectorAll('article span, main span')) as any[];
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text && text.length > 20 && !text.includes('Follow') && !text.includes('Log in')) {
        caption = text;
        break;
      }
    }
  }

  // Fallback 3: strip the page title prefix to get the caption portion
  // Instagram titles look like: "Instagram photo by @user • …date…: caption"
  if (!caption) {
    const title = doc.title || '';
    const colonIdx = title.indexOf(': ');
    if (colonIdx !== -1) caption = title.slice(colonIdx + 2).replace(/ on Instagram$/, '').trim();
  }

  const isLoginWall =
    doc.querySelector('input[name="username"]') !== null ||
    (doc.title || '').toLowerCase().includes('log in');

  const author = doc.querySelector('meta[property="og:title"]')?.content || '';
  const imageUrl = doc.querySelector('meta[property="og:image"]')?.content;
  const videoUrl = doc.querySelector('meta[property="og:video"]')?.content;
  const mediaUrls = [imageUrl, videoUrl].filter(Boolean);
  const pageTitle = doc.title;
  const metaTags = Array.from(doc.querySelectorAll('meta')).map((meta: any) => ({
    name: meta.name || meta.getAttribute('property') || '',
    content: meta.content || '',
  }));

  return { caption, author, mediaUrls, pageTitle, metaTags, isLoginWall };
};

export const EXTRACT_PROFILE_SCRIPT = (limit: number) => () => {
  const doc = (globalThis as any).document;
  const posts = [];
  const postElements = Array.from(
    doc.querySelectorAll('article a[href*="/p/"], article a[href*="/reel/"]'),
  ).slice(0, limit);

  for (const el of postElements as any[]) {
    const href = el.href;
    let type = 'unknown';
    if (href.includes('/reel/')) type = 'reel';
    else if (href.includes('/p/')) type = 'post';

    const img = el.querySelector('img');
    const caption = img ? img.alt : '';
    const svg = el.querySelector('svg');
    let iconType = 'unknown';

    if (svg) {
      const title = svg.querySelector('title');
      if (title) {
        const text = title.textContent.toLowerCase();
        if (text.includes('pinned')) iconType = 'pinned';
        else if (text.includes('reel')) iconType = 'reel';
        else if (text.includes('image')) iconType = 'image';
      }
    }

    posts.push({ url: href, caption, type, iconType });
  }

  return posts;
};
