// Loading the YouTube IFrame API with a plain script tag.
//
// NO NPM PACKAGE, which was asked for and is also the right answer. The
// wrappers all do the same two things this file does, in more code, and
// they add a dependency to a page whose whole job is to be fast on a
// phone.
//
// THE API IS A SINGLETON. It installs itself as window.YT and calls one
// global function, window.onYouTubeIframeAPIReady, exactly once ever.
// Two components both loading it would mean the second never hears
// back. So this module loads it at most once and hands everybody the
// same promise.
//
// youtube-nocookie.com is the host. It is the same player, served from
// a domain that does not set advertising cookies until somebody
// actually plays something. For a learning page, watched by people on
// metered connections, it is the only sensible choice.

export type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  destroy(): void;
};

// The player's own numbers. Written out rather than used as bare
// integers, because "state === 1" tells a reader nothing.
export const YT_UNSTARTED = -1;
export const YT_ENDED = 0;
export const YT_PLAYING = 1;
export const YT_PAUSED = 2;
export const YT_BUFFERING = 3;
export const YT_CUED = 5;

/**
 * Why a video will not play, in words rather than a number.
 *
 * YouTube reports these as error codes on a page that otherwise shows a
 * black rectangle. A learner seeing a black rectangle assumes the site
 * is broken and leaves; a learner told the video has been removed tells
 * their tutor, which is the thing that actually gets it fixed.
 */
export function videoProblem(code: number): string {
  switch (code) {
    case 2:
      return "This lesson's video address is not right.";
    case 5:
      return "This video will not play in this browser.";
    case 100:
      return "This lesson's video has been removed or made private.";
    case 101:
    case 150:
      return "The owner of this video has not allowed it to play outside YouTube.";
    default:
      return "This lesson's video will not play.";
  }
}

type YTNamespace = {
  Player: new (el: HTMLElement | string, options: unknown) => YTPlayer;
  PlayerState: Record<string, number>;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<YTNamespace> | null = null;

/** Resolves once window.YT is usable. Loads the script at most once. */
export function loadYouTube(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise<YTNamespace>((resolve, reject) => {
    // If something else on the page already asked for it, wait rather
    // than adding a second tag.
    const already = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]',
    );

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      // Whatever was waiting before us still gets its call.
      if (typeof previous === "function") previous();
      if (window.YT && window.YT.Player) resolve(window.YT);
      else reject(new Error("the player did not load"));
    };

    if (!already) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      tag.onerror = () => reject(new Error("the player could not be reached"));
      document.head.appendChild(tag);
    }

    // A connection that never answers would otherwise leave the page
    // showing a loading state for ever. Twenty seconds is long enough
    // for a slow phone and short enough that nobody sits staring.
    window.setTimeout(() => {
      if (!(window.YT && window.YT.Player)) {
        reject(new Error("the player took too long to load"));
      }
    }, 20000);
  });

  // A failed load must not be remembered as a permanent failure: the
  // next attempt should be allowed to try again.
  loading.catch(() => {
    loading = null;
  });

  return loading;
}
