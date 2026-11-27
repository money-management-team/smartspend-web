import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { MOBILE_NAMESPACE } from "../i18n/messages.js";
import Chevron from "../ui/Chevron.jsx";
import { actionPath } from "./actionRoutes.js";

/*
 * On a record's page: the changes Mobile has a form for. Each opens the form,
 * which can be filled in and reviewed; the review says that sending is done in
 * the full version for now. `actions` is a list of workflow ids; `ids` fills the
 * address (actionRoutes.js).
 */
export default function DraftLinks({ actions, ids }) {
  const { t } = useTranslation(MOBILE_NAMESPACE);
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  if (actions.length === 0) return null;

  return (
    <div className="sm-draft-links" data-sm-draft-links={actions.join(" ")}>
      <p className="sm-text sm-muted sm-fine">{t("forms.linksHint")}</p>
      {actions.map((workflow) => (
        <Link key={workflow} className="sm-link-row" to={actionPath(workflow, ids)} state={{ from }} data-sm-action={workflow}>
          <span>{t(`forms.flows.${workflow}.link`)}</span>
          <Chevron />
        </Link>
      ))}
    </div>
  );
}
