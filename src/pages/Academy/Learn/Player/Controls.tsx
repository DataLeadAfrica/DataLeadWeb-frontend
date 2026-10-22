import { CaptionsIcon, ExpandIcon, PauseIcon, PlayIcon, SoundIcon } from "../../ui/Icons";
import { captionButton, clockText, scrubFraction } from "./controls.js";

import "./Controls.css";

// The player's own control bar.
//
// WHY IT EXISTS. File 25 switches YouTube's bar off, for two reasons.
// One is that a learner had two sets of controls, ours for speed and
// theirs for everything else, which is one set too many. The other is
// that their bar carries a share button and a copy link, and a learning
// page should not hand somebody the video's address.
//
// WHAT THIS DOES NOT DO is make the video undownloadable. The video id
// is in the page source and in the network traffic whatever the player
// looks like, so anybody who goes looking will find it. Hiding the
// button stops it being offered, which is a different and smaller
// claim. Said here so that nobody reads this file and concludes the
// videos are protected.
//
// PRESENTATIONAL ON PURPOSE. Everything here is props and callbacks:
// the page owns the player and the state, this draws it. The arithmetic
// lives in controls.js, beside a .d.ts, so node --test can reach it
// without a browser, which matters because YouTube cannot be reached
// from the machine the tests run on.
//
// THE SCRUB AND THE VOLUME ARE RANGE INPUTS. Keyboard support, screen
// reader support and a drag that behaves the way every other slider on
// the person's machine behaves, all for free. A div with pointer maths
// gets none of that right the first time.

type Props = {
  playing: boolean;
  onPlayPause: () => void;

  position: number;
  duration: number;
  onSeek: (seconds: number) => void;

  volume: number;
  muted: boolean;
  onVolume: (value: number) => void;
  onMute: () => void;

  captionsAvailable: boolean | null;
  captionsOn: boolean;
  onCaptions: () => void;

  rate: number;
  rateOptions: number[];
  onRate: (value: number) => void;

  onFullscreen: () => void;
};

export default function Controls({
  playing,
  onPlayPause,
  position,
  duration,
  onSeek,
  volume,
  muted,
  onVolume,
  onMute,
  captionsAvailable,
  captionsOn,
  onCaptions,
  rate,
  rateOptions,
  onRate,
  onFullscreen,
}: Props) {
  const fraction = scrubFraction(position, duration);
  const cc = captionButton(captionsAvailable, captionsOn);

  return (
    <div className="acad-bar">
      {/* THE SCRUB. Its value is a fraction rather than seconds, so a
          lesson whose length was never recorded still renders a bar at
          zero instead of dividing by nothing. */}
      <input
        className="acad-bar__scrub"
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={fraction}
        disabled={duration <= 0}
        aria-label="Position in the lesson"
        aria-valuetext={`${clockText(position)} of ${clockText(duration)}`}
        style={{ "--acad-bar-at": `${fraction * 100}%` } as React.CSSProperties}
        onChange={(e) => onSeek(Number(e.target.value) * duration)}
      />

      <div className="acad-bar__row">
        <button
          type="button"
          className="acad-bar__btn"
          onClick={onPlayPause}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <span className="acad-bar__clock acad-mono">
          {clockText(position)} / {clockText(duration)}
        </span>

        <span className="acad-bar__vol">
          <button
            type="button"
            className="acad-bar__btn"
            onClick={onMute}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
          >
            <SoundIcon muted={muted} />
          </button>
          <input
            className="acad-bar__volslider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : volume}
            aria-label="Volume"
            onChange={(e) => onVolume(Number(e.target.value))}
          />
        </span>

        <span className="acad-bar__spacer" />

        <button
          type="button"
          className="acad-bar__btn acad-bar__btn--wide"
          onClick={onCaptions}
          aria-label={cc.label}
          aria-pressed={cc.pressed}
          disabled={cc.disabled}
          title={cc.disabled ? "This video has no caption track" : cc.label}
        >
          <CaptionsIcon />
        </button>

        {/* THE SPEED, with the first watch cap kept. The list of
            options is handed in already capped, so this never has to
            know the rule, only draw it. */}
        <label className="acad-bar__speed">
          <span className="acad-bar__speedlabel">Speed</span>
          <select
            value={String(rate)}
            aria-label="Playback speed"
            onChange={(e) => onRate(Number(e.target.value) || 1)}
          >
            {rateOptions.map((r) => (
              <option key={r} value={String(r)}>
                {r}x
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="acad-bar__btn"
          onClick={onFullscreen}
          aria-label="Full screen"
        >
          <ExpandIcon />
        </button>
      </div>
    </div>
  );
}
