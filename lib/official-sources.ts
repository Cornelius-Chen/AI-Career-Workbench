// Official employer pages verified while reviewing the 2027 graduate intake.
// Keep this list explicit; importing a job must not permit arbitrary fetch hosts.
export const officialEmployerHosts = [
  'amazon.jobs',
  'www.hudsonrivertrading.com',
  'www.janestreet.com',
  'www.imc.com',
  'www.drw.com',
  'www.citadel.com',
  'www.capitalonecareers.com',
];

export function structuredBoardInfo(value: string) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const p = u.pathname.split('/').filter(Boolean);
  if (u.hostname === 'www.hudsonrivertrading.com' && u.pathname === '/careers/job/') {
    const id = u.searchParams.get('gh_jid');
    // The employer embeds this board on its official job page.
    return id && /^\d+$/.test(id) ? { type: 'greenhouse', board: 'wehrtyou', id } : null;
  }
  if (u.hostname === 'jobs.ashbyhq.com') return { type: 'ashby', board: p[0], id: p[1] };
  if (['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(u.hostname)) {
    if (u.pathname === '/embed/job_app') {
      const board = u.searchParams.get('for'), id = u.searchParams.get('token');
      return board && /^[\w-]+$/.test(board) && id && /^\d+$/.test(id)
        ? { type: 'greenhouse', board, id } : null;
    }
    return { type: 'greenhouse', board: p[0], id: p[p.length - 1] };
  }
  return null;
}

export function hasEmployerApplicationLink(value: string, html: string) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  // Google renders one role-specific Apply anchor with an opaque jobId.
  // Its relative href is rooted at the public Careers applications base.
  if (u.hostname === 'www.google.com' && /^\/about\/careers\/applications\/jobs\/results\/\d+-[^/]+\/?$/.test(u.pathname)) {
    const links = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
      .map(m => m[1].replace(/&amp;/g, '&'))
      .filter(href => /^(?:\.\/apply\?|\/about\/careers\/applications\/apply\?|https:\/\/www\.google\.com\/about\/careers\/applications\/apply\?)/.test(href));
    if (links.length !== 1) return false;
    const apply = new URL(links[0], 'https://www.google.com/about/careers/applications/');
    return apply.searchParams.has('jobId') && !!apply.searchParams.get('jobId');
  }
  const match = u.hostname === 'www.janestreet.com'
    && u.pathname.match(/^\/join-jane-street\/position\/(\d+)\/?$/);
  return !!match && new RegExp('href=["\'](?:https://www\\.janestreet\\.com)?/join-jane-street/apply/' + match[1] + '/?["\']').test(html);
}
