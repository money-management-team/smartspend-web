import { Navigate, useParams } from "react-router-dom";

import { getWhatsAppDraftPath } from "../../../../routes/Path.js";

/*
 * Entry for the review link the backend puts in its WhatsApp replies
 * (`/whatsapp/drafts/{id}`, config whatsapp.review_path). It is mounted
 * inside RequireAuth, so a signed-out visitor is sent to sign-in first and
 * returns here afterwards, and no draft data is rendered before that.
 *
 * It only forwards to the real review page. The target is the fixed dashboard
 * path plus the id as an encoded path segment: nothing from the link can
 * choose another destination (no open redirect), and the backend decides
 * whether the draft belongs to the user (otherwise "not found").
 */
export default function WhatsAppDraftLink() {
  const { draftId } = useParams();
  return <Navigate to={getWhatsAppDraftPath(draftId)} replace />;
}
