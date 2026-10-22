# File 25: what to check on the Vercel preview

**There is nothing to run in Supabase.** File 25 is front end only. No numbered SQL file, no verify,
no undo, nothing to paste. Merge the branch and the preview is the whole test.

**Why there is a checklist at all.** YouTube cannot be reached from the machine I build on. Every
request to it is refused before it leaves, so I can test the arithmetic behind the control bar, and I
have, but I cannot watch a real video play. These are the things only a real video can show.

Open any lesson with a video on the preview and go through these in order. Each one says what you
should see and what it means if you do not.

## 1. Captions

**The one most likely to need another go.** YouTube's caption module answers to two different names
depending on the video, and neither is documented any more, so the player tries both and treats
silence as "this video has no captions".

1. Press the captions button on the control bar.
2. Captions should appear over the video.
3. Press it again. They should go.

If nothing happens on a video you know has captions, tell me and I will add the other way of asking.
If the button turns itself off and says **No captions** on a video that has them, tell me that too:
that is the opposite fault and it is worth knowing which one we have.

## 2. The copy link is gone

1. Hover over the video. There should be no title bar across the top and no share button.
2. Right click on the video. You should get your browser's ordinary menu, **not** YouTube's
   "Copy video URL".
3. There should be no YouTube logo linking out in the corner.

**What this does not do.** The video's address is still in the page source and in the network
traffic, so somebody who opens developer tools, or pastes the page address into one of the sites that
download from a page, can still get the file. This stops a learner being handed the link. It does not
stop a determined person. If you need the videos genuinely protected, that means moving them off
YouTube, which is a separate decision with a running cost.

## 3. One set of controls

There should be exactly one control bar, ours, under the video. No YouTube bar on top of the picture.

1. Play and pause, from the button.
2. Click the picture itself. It should also play and pause.
3. Drag the scrub bar. The video should move and the clock should follow.
4. Volume slider and the mute button.
5. Full screen. **The control bar should still be there in full screen**, under the video, not gone.
   Press Escape to come back.

## 4. The first watch speed cap

On a lesson you have **not** watched through:

1. Open the speed list. It should offer 0.75x, 1x, 1.25x and 1.5x, and nothing above.
2. On a lesson you have watched through, the same list should offer 1.75x and 2x as well, and a line
   under the video should say "Any speed, now you have watched it through."

## 5. Coverage still counts

This is the one that would be expensive to get wrong, because it decides whether anybody can finish a
course.

1. Watch a minute of a lesson you have not finished.
2. The tape under the video should fill as you go.
3. Reload the page. It should come back where you left it, with the same amount filled.
4. Skip ahead with the scrub bar without watching. The tape should **not** fill for the part you
   skipped, and "Mark this lesson done" should stay refused.

If the tape stops filling, stop and tell me before anybody is asked to use it.

## 6. On a phone

1. The control bar should wrap rather than run off the side.
2. The volume slider is deliberately hidden on a narrow screen, since the phone has its own volume
   keys. The mute button stays.
3. Play, pause and scrub should all work by touch.

## What I could test here

The arithmetic behind the bar, in `tests/player-controls.test.mjs`: where a click on the scrub bar
seeks to, where the playhead sits, volume staying between silent and full, the clock reading the way
somebody would say it, and what the captions button should say in each of its three states.

The case worth having among those is a lesson whose length was never recorded. It reports zero, and a
scrub bar that divides by that puts `NaN` into a style attribute, which browsers quietly drop, so the
bar renders at whatever width it had before. File 20 existed because video lessons were going out
with no length recorded, so that is not a hypothetical.
