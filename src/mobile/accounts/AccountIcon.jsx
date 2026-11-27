import { LuBanknote, LuLandmark, LuPiggyBank, LuTarget, LuWallet } from "react-icons/lu";

const ICONS = { cash: LuBanknote, bank: LuLandmark, wallet: LuWallet, savings: LuPiggyBank, savings_goal: LuTarget };

/* A decorative icon for an account's kind. It carries no meaning of its own: the type is always written next to it. */
/* `row`: sized for a list row rather than a tile. */
export default function AccountIcon({ account, row = false }) {
  const kind = account.isGoal ? "savings_goal" : account.type;
  const Icon = ICONS[kind] ?? LuWallet;

  // data-sm-kind lets a screen tint the icon by kind (Accounts does); the kind is always written beside it too.
  return (
    <span className={`sm-tile-icon${row ? " sm-row-icon" : ""}`} data-sm-kind={ICONS[kind] ? kind : "other"} aria-hidden="true">
      <Icon />
    </span>
  );
}
