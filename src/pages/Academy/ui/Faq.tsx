import "./Faq.css";

// Questions that open and close.
//
// Built on <details> and <summary> rather than on state and a click
// handler. The browser already knows how to open and close one, how to
// reach it with a keyboard and how to tell a screen reader what it is,
// and a page's own find on this page can open one to show a match
// inside it. Rewriting that with React would be more code that does
// less.
//
// Deliberately NOT marked up as FAQPage. Google retired FAQ rich
// results, so the markup would be weight on the page that nothing reads.

export type FaqItem = { question: string; answer: string };

export default function Faq({ items }: { items: FaqItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="acad-faq">
      {items.map((item, i) => (
        <details key={i} className="acad-faq__item" open={i === 0}>
          <summary className="acad-faq__q">
            <span>{item.question}</span>
            <i aria-hidden="true" />
          </summary>
          <p className="acad-faq__a">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
