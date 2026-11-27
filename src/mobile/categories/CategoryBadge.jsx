import { createElement } from "react";
import {
  LuBriefcase, LuCar, LuCoffee, LuGamepad2, LuGift, LuGraduationCap, LuHeartPulse, LuHouse, LuPiggyBank, LuPlane, LuReceipt, LuShirt,
  LuShoppingCart, LuSmartphone, LuTag, LuTrendingDown, LuTrendingUp, LuUtensils, LuWallet, LuZap,
} from "react-icons/lu";

// The icon names the full version stores (display only: Mobile never writes an icon). Anything else falls back to the type's icon.
const ICONS = {
  wallet: LuWallet, briefcase: LuBriefcase, gift: LuGift, "piggy-bank": LuPiggyBank, utensils: LuUtensils, coffee: LuCoffee,
  "shopping-cart": LuShoppingCart, shirt: LuShirt, car: LuCar, plane: LuPlane, home: LuHouse, house: LuHouse, zap: LuZap, receipt: LuReceipt,
  smartphone: LuSmartphone, "heart-pulse": LuHeartPulse, "graduation-cap": LuGraduationCap, gamepad: LuGamepad2, tag: LuTag,
  food: LuUtensils, shopping: LuShoppingCart, transport: LuCar, travel: LuPlane, bills: LuReceipt, utilities: LuZap, health: LuHeartPulse,
  education: LuGraduationCap, entertainment: LuGamepad2, salary: LuBriefcase, savings: LuPiggyBank, "trending-up": LuTrendingUp, "trending-down": LuTrendingDown,
};
const TYPE_ICONS = { income: LuTrendingUp, expense: LuTrendingDown };

/*
 * A category's icon in a round badge, tinted by its colour when it has a valid one.
 * The tint is only a wash behind the icon (the icon and the name keep the text
 * colour), and the badge is decoration: the name and the type are text beside it.
 */
export default function CategoryBadge({ category }) {
  const known = category.icon && Object.hasOwn(ICONS, category.icon);
  const Icon = (known && ICONS[category.icon]) || TYPE_ICONS[category.type] || LuTag;

  return (
    <span className="sm-cat-badge" aria-hidden="true" style={category.color ? { "--sm-cat-color": category.color } : undefined} data-sm-tinted={category.color ? "true" : undefined}>
      {createElement(Icon)}
    </span>
  );
}
