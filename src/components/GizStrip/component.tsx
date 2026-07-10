import "./component.css";

/**
 * GIZ-ZME announcement strip.
 *
 * TEMPORARY. Applications close once 600 places are filled. To remove it,
 * delete the <GizStrip /> line from Courses/page.tsx and Index/page.tsx,
 * then delete this folder.
 *
 * The programme page is a static file in /public, so the CTA is a plain
 * <a href>, not a react-router <Link>.
 */
export default function GizStrip() {
  return (
    <div className="giz-strip">
      <div className="giz-strip__main">
        <div className="giz-strip__pills">
          <span className="giz-pill giz-pill--free">Full scholarship</span>
          <span className="giz-pill giz-pill--open">Applications open</span>
          <span className="giz-pill giz-pill--cap">Abuja · 2 days</span>
        </div>

        <h3 className="giz-strip__title">
          <em>GIZ-ZME</em> Remote Work Training Programme
        </h3>
        <p className="giz-strip__sub">
          A fully funded programme for returning and potential migrants. Learn the
          tools, platforms and habits that let you earn from anywhere.
        </p>

        <div className="giz-strip__foot">
          <a className="giz-strip__cta" href="/giz">
            Apply now &rarr;
          </a>
          <div className="giz-strip__partners">
            <small>With</small>
            <img
              src="/assets/giz/giz-lockup.png"
              alt="German Cooperation, implemented by GIZ"
              className="giz-strip__logo giz-strip__logo--giz"
            />
            <img
              src="/assets/giz/fmle.png"
              alt="Federal Ministry of Labour and Employment"
              className="giz-strip__logo giz-strip__logo--fmle"
            />
          </div>
        </div>
      </div>

      <div className="giz-strip__art">
        <div>
          <div className="giz-strip__num">600</div>
          <div className="giz-strip__numlbl">Funded places</div>
        </div>
      </div>
    </div>
  );
}
