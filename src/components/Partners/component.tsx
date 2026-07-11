import "./component.css";

import image_1 from "./assets/1.png";
import image_2 from "./assets/2.png";
import image_3 from "./assets/3.png";
import image_4 from "./assets/4.png";
import image_5 from "./assets/5.png";
import image_6 from "./assets/6.png";
import image_7 from "./assets/7.png";
import image_8 from "./assets/8.png";
import image_9 from "./assets/9.png";
import image_10 from "./assets/10.png";
import image_11 from "./assets/11.png";

const images = [
  image_1,
  image_2,
  image_3,
  image_4,
  image_5,
  image_6,
  image_7,
  image_8,
  image_9,
  image_10,
  image_11,
];

export default function Partners() {
  return (
    <div className="partners">
      <h2>Partners in change</h2>
      <div className="partners__grid">
        {images.map((v, i) => {
          return (
            <div className="partners__cell" key={i}>
              <img className="partners__partner" src={v} alt="" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
