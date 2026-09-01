export default function HomeBackgroundDecor() {
  return (
    <div
      className="home-background-decor"
      aria-hidden="true"
    >
      <svg
        className="home-background-decor__lines"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path
          className="home-background-decor__path home-background-decor__path--primary"
          d="M-80 205 C190 45 405 315 705 178 S1185 42 1520 222"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
        />

        <path
          className="home-background-decor__path home-background-decor__path--insights"
          d="M-70 690 C245 520 480 785 825 615 S1210 490 1510 650"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
        />

        <path
          className="home-background-decor__path home-background-decor__path--success"
          d="M960 -35 C1110 145 1090 315 1505 388"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="home-background-decor__item home-background-decor__arc home-background-decor__arc--start">
        <span />
      </div>

      <div className="home-background-decor__item home-background-decor__arc home-background-decor__arc--end">
        <span />
      </div>

      <div className="home-background-decor__item home-background-decor__dots home-background-decor__dots--top">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="home-background-decor__item home-background-decor__dots home-background-decor__dots--bottom">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
