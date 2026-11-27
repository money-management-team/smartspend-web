import { useState } from "react";

// Uses a hook through the JSX runtime: it only renders if the server and the test share one React.
export default function HookProbe() {
  const [value] = useState("one React");
  return <p>{value}</p>;
}
