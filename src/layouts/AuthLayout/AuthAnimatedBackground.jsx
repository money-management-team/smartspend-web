const ORBS = ["one", "two", "three", "four", "five"];
const ORBITS = ["one", "two"];

export default function AuthAnimatedBackground() {
  return (
    <div className="auth-background" aria-hidden="true">
      <span className="auth-background__mesh" />

      {ORBS.map((orb) => (
        <span
          className={`auth-background__orb auth-background__orb--${orb}`}
          key={orb}
        />
      ))}

      {ORBITS.map((orbit) => (
        <span
          className={`auth-background__orbit auth-background__orbit--${orbit}`}
          key={orbit}
        >
          <span className="auth-background__satellite" />
        </span>
      ))}
    </div>
  );
}
