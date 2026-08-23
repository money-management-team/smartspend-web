import SavingsGoalsHeader from "./components/SavingsGoalsHeader/SavingsGoalsHeader";
import SavingsGoalCard from "./components/SavingsGoalCard/SavingsGoalCard";

import "./SavingsGoals.css";

const goals = [
  {
    id: 1,
    key: "emergency",
    saved: 17400,
    target: 24000,
    progress: 73,
    activePlan: "balanced",

    plans: {
      fast: 1188,
      balanced: 726,
      comfortable: 462,
    },
  },

  {
    id: 2,
    key: "studio",
    saved: 12800,
    target: 40000,
    progress: 32,
    activePlan: "comfortable",

    plans: {
      fast: 4896,
      balanced: 2992,
      comfortable: 1904,
    },
  },

  {
    id: 3,
    key: "macbook",
    saved: 2950,
    target: 3600,
    progress: 82,
    activePlan: "fast",

    plans: {
      fast: 117,
      balanced: 72,
      comfortable: 46,
    },
  },
];

export default function SavingsGoals() {
  return (
    <div className="savings-goals-page">
      <SavingsGoalsHeader />

      <section className="savings-goals-page__grid">
        {goals.map((goal) => (
          <SavingsGoalCard
            key={goal.id}
            goal={goal}
          />
        ))}
      </section>
    </div>
  );
}