import { Navigate, useParams } from "react-router-dom";

import { getSavingsGoalDetailsPath } from "./Path";

/*
 * With smart savings off, a smart-plan link (an old bookmark, a shared URL)
 * opens the goal it belongs to instead of a "not available" page.
 */
export default function SavingsGoalRedirect() {
  const { savingsGoalId } = useParams();

  return <Navigate to={getSavingsGoalDetailsPath(savingsGoalId)} replace />;
}
