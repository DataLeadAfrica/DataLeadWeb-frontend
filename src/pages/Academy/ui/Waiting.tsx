// Holds a page's place while its code is fetched.
//
// Not a spinner. The minimum height is a stage with something on it, so
// the footer does not sit under the header for a moment and then get
// shoved down the screen when the real page arrives. A layout that
// shifts under somebody's thumb as they reach for a button is the most
// annoying thing a page can do, and search engines now measure it.
//
// The background is the Academy's own stage colour written out rather
// than taken from a token, because at this moment the page's stylesheet
// may still be on its way.

export default function Waiting() {
  return (
    <main
      className="acad"
      style={{ minHeight: "70vh", background: "#eceff3" }}
      aria-busy="true"
    />
  );
}
