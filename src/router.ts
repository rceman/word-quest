import { reactive } from 'vue';

/**
 * Tiny hash router — deep links and reloads work offline on static hosts
 * (no server-side SPA fallback needed).
 */

export type RouteName =
  | 'home'
  | 'learn'
  | 'quiz'
  | 'review'
  | 'results'
  | 'progress';

export interface Route {
  name: RouteName;
  lesson?: number;
}

function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  switch (parts[0]) {
    case 'learn': {
      const lesson = Number(parts[1]);
      return { name: 'learn', lesson: [1, 3, 5].includes(lesson) ? lesson : 1 };
    }
    case 'quiz': {
      const lesson = Number(parts[1]);
      return { name: 'quiz', lesson: [1, 3, 5].includes(lesson) ? lesson : 1 };
    }
    case 'review':
      return { name: 'review' };
    case 'results':
      return { name: 'results' };
    case 'progress':
      return { name: 'progress' };
    default:
      return { name: 'home' };
  }
}

export const route = reactive<Route>(parseHash(location.hash));

export function navigate(r: Route): void {
  const hash =
    r.name === 'learn' || r.name === 'quiz'
      ? `#/${r.name}/${r.lesson}`
      : `#/${r.name === 'home' ? '' : r.name}`;
  if (location.hash === hash) {
    // Same-target navigation still re-renders (used after Atkārtot kļūdas).
    Object.assign(route, r);
    return;
  }
  location.hash = hash;
}

window.addEventListener('hashchange', () => {
  Object.assign(route, parseHash(location.hash));
});
