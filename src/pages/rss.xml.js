import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { absoluteUrl } from '../lib/site';

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  return rss({
    title: 'Easy Suite 博客',
    description: 'EasyAgent 与 EasyGateway 的产品动态、使用技巧与构建思路。',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: absoluteUrl(`/blog/${post.id}/`),
    })),
    customData: '<language>zh-CN</language>',
  });
}
