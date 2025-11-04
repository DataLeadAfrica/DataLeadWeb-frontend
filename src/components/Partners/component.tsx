import "./component.css";

import image_1 from "./assets/1.png";
import image_2 from "./assets/2.png";
import image_3 from "./assets/3.png";
import image_4 from "./assets/4.png";
import image_5 from "./assets/5.png";
import image_6 from "./assets/6.png";
import image_7 from "./assets/7.png";
import image_8 from "./assets/8.png";

const images = [
  image_1,
  image_2,
  image_3,
  image_4,
  image_5,
  image_6,
  image_7,
  image_8,
];

export default function Partners() {
  return (
    <div className="partners">
      <h2>Partners in change</h2>
      <div>
        {images.map((v) => {
          return (
            <div>
              <img src={v} />{" "}
            </div>
          );
        })}
      </div>
    </div>
  );
}
