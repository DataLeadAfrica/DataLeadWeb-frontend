import "./component.css";

export type TrainingShot = { src: string; caption: string };

// A slow, auto-scrolling strip of real training photos. Pauses on hover,
// respects reduced-motion (see component.css). Images are duplicated once so
// the marquee loops seamlessly. `src` paths point at /public/assets/...
export default function TrainingGallery({
  images,
  heading = "Inside the training",
  eyebrow = "Real cohorts, real work",
}: {
  images: TrainingShot[];
  heading?: string;
  eyebrow?: string;
}) {
  if (!images || images.length === 0) return null;
  const loop = [...images, ...images];
  return (
    <section className="tg">
      <div className="tg__head">
        <p className="tg__eyebrow">{eyebrow}</p>
        <h2 className="tg__title">{heading}</h2>
      </div>
      <div className="tg__viewport">
        <div className="tg__track">
          {loop.map((shot, i) => (
            <figure className="tg__item" key={i}>
              <img src={shot.src} alt={shot.caption} loading="lazy" />
              <figcaption>{shot.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
