export default function HomeBackgroundDecor() {
  return (
    <div className="home-background-decor" aria-hidden="true">
      <div className="home-background-decor__grid" />
      <div className="home-background-decor__beam home-background-decor__beam--one" />
      <div className="home-background-decor__beam home-background-decor__beam--two" />
      <div className="home-background-decor__side-light home-background-decor__side-light--start" />
      <div className="home-background-decor__side-light home-background-decor__side-light--end" />
      <div className="home-background-decor__orb home-background-decor__orb--blue" />
      <div className="home-background-decor__orb home-background-decor__orb--purple" />
      <div className="home-background-decor__orb home-background-decor__orb--green" />

      <svg className="home-background-decor__lines" viewBox="0 0 1600 1000" preserveAspectRatio="none" focusable="false">
        <path className="home-background-decor__path home-background-decor__path--primary" d="M-120 250 C240 40 520 330 870 145 S1320 65 1710 260" pathLength="1" vectorEffect="non-scaling-stroke" />
        <path className="home-background-decor__path home-background-decor__path--secondary" d="M-100 790 C300 585 565 880 970 635 S1420 540 1690 720" pathLength="1" vectorEffect="non-scaling-stroke" />
      </svg>

      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          className={`home-background-decor__particle home-background-decor__particle--${index + 1}`}
        />
      ))}

      <span className="home-background-decor__micro-ring home-background-decor__micro-ring--one" />
      <span className="home-background-decor__micro-ring home-background-decor__micro-ring--two" />
      <span className="home-background-decor__micro-ring home-background-decor__micro-ring--three" />
    </div>
  );
}
