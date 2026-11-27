import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { useTranslation } from "react-i18next";

/*
 * Points in the reading direction: right in English, left in Arabic. A "back"
 * chevron points the other way, toward where the reader came from.
 */
export default function Chevron({ back = false }) {
  const { i18n } = useTranslation();
  const rtl = i18n.dir() === "rtl";
  const Icon = rtl === back ? LuChevronRight : LuChevronLeft;

  return (
    <span className="sm-chevron" aria-hidden="true">
      <Icon />
    </span>
  );
}
