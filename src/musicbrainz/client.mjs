export const REQUEST_RULES = { intervalMs: 1100, timeoutMs: 20000, attempts: 3, retryBaseMs: 1500, maxRetryWaitMs: 15000 };
export const abortError = () => new DOMException('请求已取消', 'AbortError');
export function waitFor(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(abortError()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export function createClient({ fetchImpl = (...args) => fetch(...args), rules = REQUEST_RULES, now = Date.now } = {}) {
  let queue = Promise.resolve();
  let lastStart = -Infinity;
  const schedule = (task, signal) => {
    const result = queue.catch(() => {}).then(async () => {
      await waitFor(Math.max(0, rules.intervalMs - (now() - lastStart)), signal);
      if (signal?.aborted) throw abortError();
      lastStart = now();
      return task();
    });
    queue = result.catch(() => {});
    return result;
  };
  async function request(url, { signal, allow404 = false, binary = false } = {}) {
    const isMB = new URL(url).hostname === 'musicbrainz.org';
    for (let attempt = 0; attempt < rules.attempts; attempt++) {
      if (signal?.aborted) throw abortError();
      const execute = async () => {
        const controller = new AbortController();
        const cancel = () => controller.abort();
        signal?.addEventListener('abort', cancel, { once: true });
        const timer = setTimeout(cancel, rules.timeoutMs);
        try {
          const response = await fetchImpl(url, { signal: controller.signal, credentials: 'omit', headers: isMB ? { 'User-Agent': 'JCardGenesis/2.1.0 (https://www.epochaudio.cn/)' } : {} });
          if (response.status === 404 && allow404) return null;
          if (!response.ok) {
            const error = new Error(`资料请求失败（HTTP ${response.status}），当前作品未改变。`);
            error.retryable = [429, 502, 503, 504].includes(response.status);
            const retryAfter = response.headers?.get('Retry-After');
            error.retryWait = retryAfter && (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - now()));
            throw error;
          }
          if (binary) return await response.blob();
          let data;
          try { data = await response.json(); } catch { throw new Error('资料响应不是有效 JSON，当前作品未改变。'); }
          if (!data || typeof data !== 'object' || Array.isArray(data) || data.error) throw new Error('资料响应无效，当前作品未改变。');
          return data;
        } catch (error) {
          if (signal?.aborted) throw abortError();
          if (controller.signal.aborted) {
            const timeout = new Error('请求超时，请重试。当前作品未改变。'); timeout.retryable = true; throw timeout;
          }
          throw error;
        } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
      };
      try { return await (isMB ? schedule(execute, signal) : execute()); }
      catch (error) {
        if (signal?.aborted) throw abortError();
        if ((!error.retryable && !(error instanceof TypeError)) || attempt === rules.attempts - 1) throw error;
        await waitFor(Math.min(rules.maxRetryWaitMs, error.retryWait || rules.retryBaseMs * (attempt + 1)), signal);
      }
    }
  }
  return { request };
}

// Owns one modal session; both abort and a sequence check guard late responses.
export function createRequestScope() {
  let controller = null;
  let sequence = 0;
  return {
    cancel() { sequence++; controller?.abort(); controller = null; },
    begin() {
      this.cancel(); controller = new AbortController(); const id = sequence;
      return { signal: controller.signal, isCurrent: () => id === sequence && !controller?.signal.aborted };
    },
  };
}
