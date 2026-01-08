import { useEffect, useMemo } from 'react';

function getOrCreateSessionId() {
  let id = sessionStorage.getItem('np_session_id');
  if (!id) {
    id = `sess-${Math.random().toString(36).substr(2, 12)}-${Date.now()}`;
    sessionStorage.setItem('np_session_id', id);
  }
  return id;
}

function trackEvent(payload) {
  const data = JSON.stringify({
    ...payload,
    deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    referrer: document.referrer || null,
  });

  if (navigator.sendBeacon) {
    // sendBeacon needs a Blob with explicit Content-Type so express.json() can parse it
    navigator.sendBeacon('/api/analytics/event', new Blob([data], { type: 'application/json' }));
  } else {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
    }).catch(() => {});
  }
}

export function usePostAnalytics(postId) {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  // Track view on mount
  useEffect(() => {
    if (!postId) return;
    trackEvent({ postId, eventType: 'view', sessionId });
  }, [postId, sessionId]);

  // Track read completion via IntersectionObserver
  useEffect(() => {
    if (!postId) return;
    const endMarker = document.getElementById('post-end');
    if (!endMarker) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        trackEvent({ postId, eventType: 'read_complete', sessionId });
        observer.disconnect();
      }
    }, { threshold: 0.9 });

    observer.observe(endMarker);
    return () => observer.disconnect();
  }, [postId, sessionId]);
}

export { trackEvent };
