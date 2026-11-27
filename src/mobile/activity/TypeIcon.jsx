import { LuArrowDownRight, LuArrowRightLeft, LuArrowUpRight, LuCircleHelp, LuUndo2 } from "react-icons/lu";

const ICONS = { income: LuArrowUpRight, expense: LuArrowDownRight, fee: LuArrowDownRight, transfer: LuArrowRightLeft, reversal: LuUndo2 };

/* A decorative icon for a transaction's kind. It carries no meaning of its own: the type is always written next to it. */
export default function TypeIcon({ transaction }) {
  const Icon = transaction.isReversal ? LuUndo2 : ICONS[transaction.type] ?? LuCircleHelp;

  return (
    <span className="sm-tx-icon" data-sm-direction={transaction.direction ?? "neutral"} aria-hidden="true">
      <Icon />
    </span>
  );
}
